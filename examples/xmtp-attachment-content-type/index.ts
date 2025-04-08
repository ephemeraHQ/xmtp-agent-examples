import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import {
  AttachmentCodec,
  ContentTypeAttachment,
  RemoteAttachmentCodec,
  type Attachment,
} from "@xmtp/content-type-remote-attachment";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Default image URL to use if no specific image is requested
const DEFAULT_IMAGE_URL = "./logo.png";

async function getAttachment(source: string): Promise<Attachment | undefined> {
  try {
    let imgArray: Uint8Array;
    let mimeType: string;
    let filename: string;

    const MAX_SIZE = 1024 * 1024; // 1MB in bytes

    // Check if source is a URL
    if (source.startsWith("http://") || source.startsWith("https://")) {
      try {
        // Handle URL
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Check Content-Length header first if available
        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > MAX_SIZE) {
          throw new Error("Image size exceeds 1MB limit");
        }

        const arrayBuffer = await response.arrayBuffer();

        // Double check actual size
        if (arrayBuffer.byteLength > MAX_SIZE) {
          throw new Error("Image size exceeds 1MB limit");
        }

        imgArray = new Uint8Array(arrayBuffer);
        mimeType = response.headers.get("content-type") || "image/jpeg";
        filename = source.split("/").pop() || "image";

        // If filename doesn't have an extension, add one based on mime type
        if (!filename.includes(".")) {
          const ext = mimeType.split("/")[1];
          filename = `${filename}.${ext}`;
        }
      } catch (error) {
        console.error("Error fetching image from URL:", error);
        throw error;
      }
    } else {
      // Handle file path
      const file = await readFile(source);

      // Check file size
      if (file.length > MAX_SIZE) {
        throw new Error("Image size exceeds 1MB limit");
      }

      filename = path.basename(source);
      const extname = path.extname(source);
      mimeType = `image/${extname.replace(".", "").replace("jpg", "jpeg")}`;
      imgArray = new Uint8Array(file);
    }

    const attachment: Attachment = {
      filename,
      mimeType,
      data: imgArray,
    };
    return attachment;
  } catch (error) {
    console.error("Failed to send image:", error);
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
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
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

    try {
      // Get the image attachment
      const attachment = await getAttachment(DEFAULT_IMAGE_URL);

      if (attachment) {
        console.log(`Sending image response to ${addressFromInboxId}...`);
        // Send the attachment directly
        await conversation.send(attachment, ContentTypeAttachment);
        console.log("Image sent successfully");
      } else {
        console.log(
          "Failed to create attachment, sending fallback text message",
        );
        await conversation.send(
          "Sorry, I couldn't send the image. Here's a text message instead.",
        );
      }
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

main().catch((error: unknown) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
