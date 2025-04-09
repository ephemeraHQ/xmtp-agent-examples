import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import axios from "axios";
import FormData from "form-data";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV, IMGBB_API_KEY } =
  validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "XMTP_ENV",
    "IMGBB_API_KEY", // Add the API key for ImgBB
  ]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Default image path to use
const DEFAULT_IMAGE_PATH = "./logo.png";

// ImgBB API response type
interface ImgBBResponse {
  data: {
    url: string;
    display_url: string;
    [key: string]: any;
  };
  success: boolean;
  status: number;
}

/**
 * Upload a file to ImgBB
 * @param fileData The file data as a Buffer or Uint8Array
 * @param filename The name of the file
 * @returns The URL of the uploaded file
 */
async function uploadToImgbb(
  fileData: Uint8Array,
  filename: string,
): Promise<string> {
  try {
    // Create form data for the upload
    const formData = new FormData();
    formData.append("image", Buffer.from(fileData), filename);

    // Upload to ImgBB
    const response = await axios.post<ImgBBResponse>(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      },
    );

    // Return the URL of the uploaded image
    if (response.data.success) {
      console.log("File uploaded successfully to ImgBB");
      // Use display_url instead of url for proper rendering
      return response.data.data.display_url;
    } else {
      throw new Error(
        "Failed to upload to ImgBB: " + JSON.stringify(response.data),
      );
    }
  } catch (error) {
    console.error("Error uploading to ImgBB:", error);
    throw error;
  }
}

/**
 * Create a remote attachment from a local file
 */
async function createRemoteAttachment(
  filePath: string,
): Promise<RemoteAttachment> {
  try {
    // Read the file from disk
    const fileData = await readFile(filePath);
    const filename = path.basename(filePath);

    // Get mime type based on extension
    const mimeType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
        ? "image/jpeg"
        : "application/octet-stream";

    // Local file details
    const attachment = {
      filename,
      mimeType,
      data: new Uint8Array(fileData),
    };
    console.log("Attachment:", attachment);
    // Upload the file to ImgBB
    const fileUrl = await uploadToImgbb(attachment.data, attachment.filename);
    console.log("File URL:", fileUrl);
    // Encrypt the attachment
    const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
      attachment,
      new AttachmentCodec(),
    );

    // Create a remote attachment with the encrypted data
    const remoteAttachment: RemoteAttachment = {
      url: fileUrl,
      contentDigest: encryptedEncoded.digest,
      salt: encryptedEncoded.salt,
      nonce: encryptedEncoded.nonce,
      secret: encryptedEncoded.secret,
      scheme: "https",
      filename: attachment.filename,
      contentLength: attachment.data.byteLength,
    };

    return remoteAttachment;
  } catch (error) {
    console.error("Failed to create remote attachment:", error);
    throw error;
  }
}

async function main() {
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
    codecs: [new RemoteAttachmentCodec(), new AttachmentCodec()],
  });

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  logAgentDetails(address, client.inboxId, XMTP_ENV);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    console.log("Message:", message);
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      (message?.contentType?.typeId !== "text" &&
        message?.contentType?.typeId !== "remoteStaticAttachment")
    ) {
      continue;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0].identifiers[0].identifier;

    // Handle received attachment
    if (message.contentType.typeId === "remoteStaticAttachment") {
      console.log("Received an attachment!");

      // Cast the content to RemoteAttachment type with proper type checking
      const attachment = message.content as RemoteAttachment;
      if (attachment.url) {
        console.log("Attachment URL:", attachment.url);
        await conversation.send(
          "I received your attachment! The URL is: " + attachment.url,
        );
      } else {
        await conversation.send(
          "I received your attachment but couldn't process it properly.",
        );
      }
      continue;
    }

    try {
      console.log(`Preparing attachment for ${addressFromInboxId}...`);

      // Create a remote attachment with proper encryption and upload
      const remoteAttachment = await createRemoteAttachment(DEFAULT_IMAGE_PATH);
      console.log("Remote attachment created successfully", remoteAttachment);
      console.log(`Sending remote attachment to ${addressFromInboxId}...`);
      // Send the remote attachment
      await conversation.send(remoteAttachment, ContentTypeRemoteAttachment);
      console.log("Remote attachment sent successfully");
    } catch (error) {
      console.error("Error sending image:", error);
      // Fallback to text message if image sending fails
      await conversation.send(
        "Sorry, I encountered an error sending the image. Here's a text message instead.",
      );
    }

    console.log("Waiting for messages...");
  }
}

/**
 * Example of how to use this code in a web context:
 *
 * // When handling a file upload in a browser (e.g., from a file input)
 * async function handleFileUploadInBrowser(file, xmtpClient, conversation) {
 *   try {
 *     // Convert File to ArrayBuffer using FileReader
 *     const arrayBuffer = await new Promise((resolve, reject) => {
 *       const reader = new FileReader();
 *       reader.onload = () => resolve(reader.result);
 *       reader.onerror = () => reject(new Error("Error reading file"));
 *       reader.readAsArrayBuffer(file);
 *     });
 *
 *     // Create Uint8Array from the array buffer
 *     const fileData = new Uint8Array(arrayBuffer);
 *
 *     // Process the file data
 *     // In a real implementation, you would:
 *     // 1. Upload the file to a hosting service like ImgBB
 *     // 2. Get the URL of the uploaded file
 *     // 3. Create an attachment with the file data and URL
 *     // 4. Send the attachment through XMTP
 *
 *     // Example pseudo-code (not actually called):
 *     // const fileUrl = await uploadToService(fileData, file.name);
 *     // const attachment = {
 *     //   filename: file.name,
 *     //   mimeType: file.type,
 *     //   data: fileData
 *     // };
 *     // const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
 *     //   attachment,
 *     //   new AttachmentCodec(),
 *     // );
 *     // const remoteAttachment = {
 *     //   url: fileUrl,
 *     //   contentDigest: encryptedEncoded.digest,
 *     //   salt: encryptedEncoded.salt,
 *     //   nonce: encryptedEncoded.nonce,
 *     //   secret: encryptedEncoded.secret,
 *     //   scheme: "https", // Note: no trailing slash
 *     //   filename: attachment.filename,
 *     //   contentLength: attachment.data.byteLength,
 *     // };
 *     // await conversation.send(remoteAttachment, ContentTypeRemoteAttachment);
 *   } catch (error) {
 *     console.error("Error handling file upload:", error);
 *   }
 * }
 */

main().catch(console.error);
