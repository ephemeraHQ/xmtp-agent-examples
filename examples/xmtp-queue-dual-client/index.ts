import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const messageQueue: string[] = [];

console.log("Starting XMTP Dual Client Agent...");

// Receiving client - listens for messages
const receivingClient = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: (inboxId) =>
    process.env.RAILWAY_VOLUME_MOUNT_PATH ??
    "." + `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}-receiving.db3`,
});

receivingClient.on("text", async (ctx) => {
  const message = ctx.message.content;
  const sender = await ctx.getSenderAddress();

  console.log(`📨 Received: "${message}" from ${sender}`);
  messageQueue.push(message);
});

receivingClient.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${receivingClient.address}`);
  console.log(`🔗${getTestUrl(receivingClient.client)}`);
});

// Sending client - processes the queue
const sendingClient = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: (inboxId) =>
    process.env.RAILWAY_VOLUME_MOUNT_PATH ??
    "." + `/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}-sending.db3`,
});

// Process queue every 2 seconds
setInterval(async () => {
  if (messageQueue.length === 0) return;

  const message = messageQueue.shift();
  if (!message) return;

  try {
    // Get all conversations and send to the most recent one
    await sendingClient.client.conversations.sync();
    const conversations = await sendingClient.client.conversations.list();

    if (conversations.length > 0) {
      const latestConv = conversations[0];
      await latestConv.send(
        "Sending client: " + message + " at " + new Date().toISOString(),
      );
      console.log(`📤 Sent: "${message}"`);
    }
  } catch (error) {
    console.error(`❌ Error sending message:`, error);
  }
}, 2000);

// Start both clients
await Promise.all([receivingClient.start(), sendingClient.start()]);

console.log("✅ Both clients running!");
