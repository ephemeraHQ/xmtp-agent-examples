import fs from "fs";
import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");

const getDbPath = (description: string = "xmtp") => {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
};

// Message queue interface
interface QueuedMessage {
  conversationId: string;
  content: string;
  timestamp: number;
}

// Message queue
const messageQueue: QueuedMessage[] = [];

// Queue processing interval in milliseconds (1 second)
const PROCESS_INTERVAL = 1000;

// Sync interval in minutes (5 minutes)
const SYNC_INTERVAL = 5;

console.log("Starting XMTP Queue Dual Client Agent...");

// Create receiving client
const receivingClient = await Agent.create(createSigner(createUser()), {
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: getDbPath("receiving"),
});

void receivingClient.start();
console.log("XMTP receiving client created");

// Create sending client
const sendingClient = await Agent.create(createSigner(createUser()), {
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: getDbPath("sending"),
});

void sendingClient.start();

// Start periodic sync for both clients
startPeriodicSync(receivingClient, sendingClient);

// Start message processor with sending client
startMessageProcessor(sendingClient);

receivingClient.on("text", (ctx) => {
  const content = ctx.message.content;
  console.log(
    `Received: "${content}" in conversation ${ctx.message.conversationId}`,
  );

  // Queue response
  const response = `Reply to: "${content}" at ${new Date().toISOString()}`;
  messageQueue.push({
    conversationId: ctx.message.conversationId,
    content: response,
    timestamp: Date.now(),
  });
});

/**
 * Start periodic sync for both clients
 */
function startPeriodicSync(
  receivingClient: Agent<any>,
  sendingClient: Agent<any>,
): void {
  console.log(`Setting up periodic sync every ${SYNC_INTERVAL} minutes`);

  setInterval(
    () => {
      void (async () => {
        console.log("Syncing receiving client...");
        await receivingClient.client.conversations.sync();
        console.log("Receiving client synced successfully");

        console.log("Syncing sending client...");
        await sendingClient.client.conversations.sync();
        console.log("Sending client synced successfully");
      })();
    },
    SYNC_INTERVAL * 60 * 1000, // 5 minutes in milliseconds
  );
}

function startMessageProcessor(client: Agent<any>): void {
  console.log("Starting message processor on sending client...");
  // Process message queue periodically
  setInterval(() => {
    void processMessageQueue(client);
  }, PROCESS_INTERVAL);
}

async function processMessageQueue(client: Agent<any>): Promise<void> {
  if (messageQueue.length === 0) return;

  // Process in FIFO order (oldest first)
  const message = messageQueue.shift();
  if (!message) return;

  try {
    // Get the conversation and send the message
    const conversation = await client.client.conversations.getConversationById(
      message.conversationId,
    );
    if (conversation) {
      await conversation.send(message.content);
      console.log(`Message sent successfully: "${message.content}"`);
    } else {
      console.error(`Conversation not found for ID: ${message.conversationId}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error sending message: ${errorMessage}`);
  }
}
