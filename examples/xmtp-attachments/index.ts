import { readFile } from "node:fs/promises";
import path from "node:path";
import { Agent } from "@xmtp/agent-sdk";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
  type Attachment,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";
import { uploadToPinata } from "./upload";

// Check this path is correct in your case of errors
const DEFAULT_IMAGE_PATH = "./logo.png";

async function createRemoteAttachment(
  filePath: string,
): Promise<RemoteAttachment> {
  // Log the full path of the image
  const fullPath = path.resolve(filePath);
  console.log(`Full path of image: ${fullPath}`);

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

const agent = await Agent.create({
  codecs: [new RemoteAttachmentCodec(), new AttachmentCodec()],
});

agent.on("message", async (ctx) => {
  const message = ctx.message;

  // Check if this is a remote attachment
  if (message.contentType?.typeId === "remoteStaticAttachment") {
    console.log("Received a remote attachment!");

    try {
      // Load and decode the received attachment
      const receivedAttachment = await RemoteAttachmentCodec.load(
        message.content as RemoteAttachment,
        agent.client,
      );

      const filename = (receivedAttachment as Attachment).filename || "unnamed";
      const mimeType =
        (receivedAttachment as Attachment).mimeType ||
        "application/octet-stream";

      console.log(`Processing attachment: ${filename} (${mimeType})`);

      // Send acknowledgment message
      await ctx.conversation.send(
        `I received your attachment "${filename}"! Processing it now...`,
      );

      // Create a new remote attachment from the decoded data
      const reEncodedAttachment = await createRemoteAttachmentFromData(
        (receivedAttachment as Attachment).data,
        filename,
        mimeType,
      );

      // Send the re-encoded attachment back
      await ctx.conversation.send(
        reEncodedAttachment,
        ContentTypeRemoteAttachment,
      );

      console.log(`Successfully sent back attachment: ${filename}`);

      // Send confirmation message
      await ctx.conversation.send(`Here's your attachment back: ${filename}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing attachment:", errorMessage);
      await ctx.conversation.send(
        "Sorry, I encountered an error processing your attachment.",
      );
    }

    return;
  }

  /* Handle text messages */
  if (message.contentType?.typeId === "text") {
    console.log(
      `Received text message: ${message.content as string} by ${message.senderInboxId}`,
    );

    const inboxState = await agent.client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0]?.identifiers[0]?.identifier;

    console.log(`Preparing attachment for ${addressFromInboxId}...`);
    await ctx.conversation.send(`I'll send you an attachment now...`);

    const remoteAttachment = await createRemoteAttachment(DEFAULT_IMAGE_PATH);
    await ctx.conversation.send(remoteAttachment, ContentTypeRemoteAttachment);

    console.log("Remote attachment sent successfully");
  }
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online: ${url}`);
});

void agent.start();
