import { readFile } from "node:fs/promises";
import path from "node:path";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
  type Attachment,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
// For Pinata uploads
import axios from "axios";
import FormData from "form-data";

const {
  WALLET_KEY,
  ENCRYPTION_KEY,
  XMTP_ENV,
  PINATA_API_KEY,
  PINATA_SECRET_KEY,
} = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
  "PINATA_API_KEY",
  "PINATA_SECRET_KEY",
]);

const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const DEFAULT_IMAGE_PATH = "./logo.png";

async function uploadToPinata(
  fileData: Uint8Array,
  filename: string,
): Promise<string> {
  console.log(`Uploading ${filename}, size: ${fileData.byteLength} bytes`);

  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  const data = new FormData();
  data.append("file", Buffer.from(fileData), {
    filename,
    contentType: "application/octet-stream",
  });

  // Using type assertion for FormData with _boundary property
  const response = await axios.post(url, data, {
    maxContentLength: Infinity,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${(data as FormData & { _boundary: string })._boundary}`,
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
  });

  interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  }

  const ipfsHash = (response.data as PinataResponse).IpfsHash;
  const fileUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  console.log("File URL:", fileUrl);

  return fileUrl;
}

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

async function main() {
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
    codecs: [new RemoteAttachmentCodec()],
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
      (message?.contentType?.typeId !== "text" &&
        message?.contentType?.typeId !== "remoteStaticAttachment")
    ) {
      continue;
    }

    console.log(`Received message with type: ${message.contentType.typeId}`);

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) continue;

    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0].identifiers[0].identifier;

    if (message.contentType.sameAs(ContentTypeRemoteAttachment)) {
      console.log("Received an attachment!");

      const attachment = (await RemoteAttachmentCodec.load(
        message.content as RemoteAttachment,
        client,
      )) as Attachment;

      const filename = attachment.filename || "unnamed";
      await conversation.send(`I received your attachment "${filename}"!`);

      continue;
    }

    console.log(`Preparing attachment for ${addressFromInboxId}...`);
    await conversation.send(`I'll send you an attachment now...`);

    const remoteAttachment = await createRemoteAttachment(DEFAULT_IMAGE_PATH);
    await conversation.send(remoteAttachment, ContentTypeRemoteAttachment);

    console.log("Remote attachment sent successfully");
  }
}

/* TODO: Not working in mobile apps */
/*
async function createNativeAttachment(
  source: string,
): Promise<Attachment | undefined> {
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
*/

void main();
