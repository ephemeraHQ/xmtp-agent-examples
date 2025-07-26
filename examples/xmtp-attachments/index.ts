import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { uploadToPinata } from "./upload";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

const signer = createSigner(WALLET_KEY);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const DEFAULT_IMAGE_PATH = "./logo.png";

async function createRemoteAttachment(
  filePath: string,
): Promise<RemoteAttachment> {
  const fileData = await readFile(filePath);
  const filename = path.basename(filePath);
  const mimeType = filename.endsWith(".png")
    ? "image/png"
    : "application/octet-stream";

  const attachment = {
    filename,
    mimeType,
    data: new Uint8Array(fileData),
  };

  const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
    attachment,
    new AttachmentCodec(),
  );

  const fileUrl = await uploadToPinata(
    encryptedEncoded.payload,
    attachment.filename,
  );
  const scheme = `${new URL(fileUrl).protocol}//`;

  return {
    url: fileUrl,
    contentDigest: encryptedEncoded.digest,
    salt: encryptedEncoded.salt,
    nonce: encryptedEncoded.nonce,
    secret: encryptedEncoded.secret,
    scheme: scheme,
    filename: attachment.filename,
    contentLength: attachment.data.byteLength,
  };
}

async function createRemoteAttachmentFromData(
  data: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<RemoteAttachment> {
  const attachment = {
    filename,
    mimeType,
    data,
  };

  const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
    attachment,
    new AttachmentCodec(),
  );

  const fileUrl = await uploadToPinata(
    encryptedEncoded.payload,
    attachment.filename,
  );
  const scheme = `${new URL(fileUrl).protocol}//`;

  return {
    url: fileUrl,
    contentDigest: encryptedEncoded.digest,
    salt: encryptedEncoded.salt,
    nonce: encryptedEncoded.nonce,
    secret: encryptedEncoded.secret,
    scheme: scheme,
    filename: attachment.filename,
    contentLength: attachment.data.byteLength,
  };
}

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    codecs: [new RemoteAttachmentCodec(), new AttachmentCodec()],
  });

  void logAgentDetails(client as Client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    /* Ignore messages from the same agent */
    if (message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    /* Get the conversation from the local db */
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    /* If the conversation is not found, skip the message */
    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    // Check if this is a remote attachment
    if (message && message.contentType?.typeId === "remoteStaticAttachment") {
      console.log("Received a remote attachment!");

      try {
        // Load and decode the received attachment
        const receivedAttachment = await RemoteAttachmentCodec.load(
          message.content as RemoteAttachment,
          client,
        );

        const filename = receivedAttachment?.filename as string;
        const mimeType = receivedAttachment.mimeType as string;

        console.log(`Processing attachment: ${filename} (${mimeType})`);

        // Send acknowledgment message
        await conversation.send(
          `I received your attachment "${filename}"! Processing it now...`,
        );

        // Create a new remote attachment from the decoded data
        const reEncodedAttachment = await createRemoteAttachmentFromData(
          receivedAttachment.data,
          filename,
          mimeType,
        );

        // Send the re-encoded attachment back
        await conversation.send(
          reEncodedAttachment,
          ContentTypeRemoteAttachment,
        );

        console.log(`Successfully sent back attachment: ${filename}`);

        // Send confirmation message
        await conversation.send(`Here's your attachment back: ${filename}`);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error processing attachment:", errorMessage);
        await conversation.send(
          "Sorry, I encountered an error processing your attachment.",
        );
      }

      continue;
    }

    /* Handle text messages */
    if (message?.contentType?.typeId === "text") {
      console.log(
        `Received text message: ${message.content as string} by ${message.senderInboxId}`,
      );

      const inboxState = await client.preferences.inboxStateFromInboxIds([
        message.senderInboxId,
      ]);
      const addressFromInboxId = inboxState[0].identifiers[0].identifier;

      console.log(`Preparing attachment for ${addressFromInboxId}...`);
      await conversation.send(`I'll send you an attachment now...`);

      const remoteAttachment = await createRemoteAttachment(DEFAULT_IMAGE_PATH);
      await conversation.send(remoteAttachment, ContentTypeRemoteAttachment);

      console.log("Remote attachment sent successfully");
    }
  }
}

// async function createNativeAttachment(
//   source: string,
// ): Promise<Attachment | undefined> {
//   try {
//     let imgArray: Uint8Array;
//     let mimeType: string;
//     let filename: string;

//     const MAX_SIZE = 1024 * 1024; // 1MB in bytes

//     // Check if source is a URL
//     if (source.startsWith("http://") || source.startsWith("https://")) {
//       try {
//         // Handle URL
//         const response = await fetch(source);
//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`);
//         }

//         // Check Content-Length header first if available
//         const contentLength = response.headers.get("content-length");
//         if (contentLength && parseInt(contentLength) > MAX_SIZE) {
//           throw new Error("Image size exceeds 1MB limit");
//         }

//         const arrayBuffer = await response.arrayBuffer();

//         // Double check actual size
//         if (arrayBuffer.byteLength > MAX_SIZE) {
//           throw new Error("Image size exceeds 1MB limit");
//         }

//         imgArray = new Uint8Array(arrayBuffer);
//         mimeType = response.headers.get("content-type") || "image/jpeg";
//         filename = source.split("/").pop() || "image";

//         // If filename doesn't have an extension, add one based on mime type
//         if (!filename.includes(".")) {
//           const ext = mimeType.split("/")[1];
//           filename = `${filename}.${ext}`;
//         }
//       } catch (error) {
//         console.error("Error fetching image from URL:", error);
//         throw error;
//       }
//     } else {
//       // Handle file path
//       const file = await readFile(source);

//       // Check file size
//       if (file.length > MAX_SIZE) {
//         throw new Error("Image size exceeds 1MB limit");
//       }

//       filename = path.basename(source);
//       const extname = path.extname(source);
//       mimeType = `image/${extname.replace(".", "").replace("jpg", "jpeg")}`;
//       imgArray = new Uint8Array(file);
//     }

//     const attachment: Attachment = {
//       filename,
//       mimeType,
//       data: imgArray,
//     };
//     return attachment;
//   } catch (error) {
//     console.error("Failed to send image:", error);
//     throw error;
//   }
// }

void main();
