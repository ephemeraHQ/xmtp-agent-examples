import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";

const { WALLET_KEY, DB_ENCRYPTION_KEY, XMTP_ENV, LOGGING_LEVEL } =
  validateEnvironment([
    "WALLET_KEY",
    "DB_ENCRYPTION_KEY",
    "XMTP_ENV",
    "LOGGING_LEVEL",
  ]);

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

async function main(): Promise<void> {
  console.log("Starting XMTP Queue Dual Client Agent...");

  // Create wallet signer and encryption key
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(DB_ENCRYPTION_KEY);

  // Create receiving client
  const receivingClient = await Client.create(signer, {
    dbEncryptionKey,
    appVersion: "example-agent/1.0.0",
    env: XMTP_ENV as XmtpEnv,
    loggingLevel: LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath(XMTP_ENV + "-receiving"),
  });

  console.log("XMTP receiving client created");
  void logAgentDetails(receivingClient);

  // Create sending client
  const sendingClient = await Client.create(signer, {
    dbEncryptionKey,
    appVersion: "example-agent/1.0.0",
    env: XMTP_ENV as XmtpEnv,
    loggingLevel: LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath(XMTP_ENV + "-sending"),
  });

  console.log("XMTP sending client created");
  void logAgentDetails(sendingClient);

  // Initial sync for both clients
  console.log("Performing initial sync for receiving client...");
  await receivingClient.conversations.sync();

  console.log("Performing initial sync for sending client...");
  await sendingClient.conversations.sync();

  // Start periodic sync for both clients
  startPeriodicSync(receivingClient, sendingClient);

  // Start message processor with sending client
  startMessageProcessor(sendingClient);

  // Start message stream with receiving client
  void setupMessageStream(receivingClient);

  process.stdin.resume(); // Keep process running
}

/**
 * Start periodic sync for both clients
 */
function startPeriodicSync(
  receivingClient: Client,
  sendingClient: Client,
): void {
  console.log(`Setting up periodic sync every ${SYNC_INTERVAL} minutes`);

  setInterval(
    () => {
      void (async () => {
        console.log("Syncing receiving client...");
        await receivingClient.conversations.sync();
        console.log("Receiving client synced successfully");

        console.log("Syncing sending client...");
        await sendingClient.conversations.sync();
        console.log("Sending client synced successfully");
      })();
    },
    SYNC_INTERVAL * 60 * 1000, // 5 minutes in milliseconds
  );
}

async function setupMessageStream(client: Client): Promise<void> {
  console.log("Setting up message stream on receiving client...");
  const stream = await client.conversations.streamAllMessages();
  console.log("Message stream started successfully");

  // Process incoming messages
  for await (const message of stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    /* Ignore non-text messages */
    if (message.contentType?.typeId !== "text") {
      continue;
    }
    const content = message.content as string;
    console.log(
      `Received: "${content}" in conversation ${message.conversationId}`,
    );

    // Queue response
    const response = `Reply to: "${content}" at ${new Date().toISOString()}`;
    messageQueue.push({
      conversationId: message.conversationId,
      content: response,
      timestamp: Date.now(),
    });

    console.log(`Queued response for conversation ${message.conversationId}`);
  }
}

function startMessageProcessor(client: Client): void {
  console.log("Starting message processor on sending client...");
  // Process message queue periodically
  setInterval(() => {
    void processMessageQueue(client);
  }, PROCESS_INTERVAL);
}

async function processMessageQueue(client: Client): Promise<void> {
  if (messageQueue.length === 0) return;

  // Process in FIFO order (oldest first)
  const message = messageQueue.shift();
  if (!message) return;

  await client.conversations.sync();
  // Get conversation
  const conversation = await client.conversations.getConversationById(
    message.conversationId,
  );

  if (!conversation) {
    console.log("Conversation not found, discarding message");
    return;
  }

  // Send message
  await conversation.send(message.content);
  console.log(`Message sent successfully: "${message.content}"`);
}

// Start the application
void main();
