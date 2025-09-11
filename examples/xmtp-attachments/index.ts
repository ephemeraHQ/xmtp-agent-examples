import { readFile } from "node:fs/promises";
import { Agent, getTestUrl } from "@xmtp/agent-sdk";
import {
  AttachmentCodec,
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
import {
  createRemoteAttachmentFromData,
  createRemoteAttachmentFromFile,
  encryptAttachment,
  loadRemoteAttachment,
} from "../../utils/atttachment";
import { uploadToPinata } from "./upload";

process.loadEnvFile(".env");
// Check this path is correct in your case of errors
const DEFAULT_IMAGE_PATH = "./logo.png";

const agent = await Agent.createFromEnv({
  codecs: [new RemoteAttachmentCodec(), new AttachmentCodec()],
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", async (ctx) => {
  console.log(
    `Received text message: ${ctx.message.content} by ${ctx.message.senderInboxId}`,
  );

  const senderAddress = await ctx.getSenderAddress();

  console.log(`Preparing attachment for ${senderAddress}...`);
  await ctx.conversation.send(`I'll send you an attachment now...`);

  const encrypted = await encryptAttachment(
    new Uint8Array(await readFile(DEFAULT_IMAGE_PATH)),
    "logo.png",
    "image/png",
  );
  const fileUrl = await uploadToPinata(
    encrypted.encryptedData,
    encrypted.filename,
  );

  const remoteAttachment = await createRemoteAttachmentFromFile(
    DEFAULT_IMAGE_PATH,
    fileUrl,
    "image/png",
  );
  await ctx.conversation.send(remoteAttachment, ContentTypeRemoteAttachment);

  console.log("Remote attachment sent successfully");
});

agent.on("attachment", async (ctx) => {
  // Load and decode the received attachment
  const receivedAttachment = await loadRemoteAttachment(
    ctx.message.content,
    agent.client,
  );

  const filename = receivedAttachment.filename || "unnamed";
  const mimeType = receivedAttachment.mimeType || "application/octet-stream";

  console.log(`Processing attachment: ${filename} (${mimeType})`);

  // Send acknowledgment message
  await ctx.conversation.send(
    `I received your attachment "${filename}"! Processing it now...`,
  );

  // Encrypt and upload the attachment data
  const encrypted = await encryptAttachment(
    receivedAttachment.data,
    filename,
    mimeType,
  );
  const fileUrl = await uploadToPinata(
    encrypted.encryptedData,
    encrypted.filename,
  );

  // Create a new remote attachment from the decoded data
  const reEncodedAttachment = await createRemoteAttachmentFromData(
    receivedAttachment.data,
    filename,
    mimeType,
    fileUrl,
  );

  // Send the re-encoded attachment back
  await ctx.conversation.send(reEncodedAttachment, ContentTypeRemoteAttachment);

  console.log(`Successfully sent back attachment: ${filename}`);

  // Send confirmation message
  await ctx.conversation.send(`Here's your attachment back: ${filename}`);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

void agent.start();
