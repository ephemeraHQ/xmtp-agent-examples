import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV, LOGGING_LEVEL } =
  validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "XMTP_ENV",
    "LOGGING_LEVEL",
  ]);

// Message queue interface
interface QueuedMessage {
  conversationId: string;
  content: string;
  priority: number;
  timestamp: number;
}

// Message queue
const messageQueue: QueuedMessage[] = [];

// Sync interval in milliseconds (60 seconds)
const SYNC_INTERVAL = 60000;

async function main(): Promise<void> {
  console.log("Starting XMTP Dual Installation Agent...");

  if (!WALLET_KEY || !ENCRYPTION_KEY || !XMTP_ENV) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Create wallet signer and encryption key
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  // Set the database path for both installations
  // Create installation A (receiver) client
  const receiverClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    loggingLevel: LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath(XMTP_ENV + "-receiver"),
  });
  console.log("Installation A (receiver) client created");

  // Create installation B (sender) client
  const senderClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    loggingLevel: LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath(XMTP_ENV + "-sender"),
  });

  console.log("Installation B (sender) client created");

  // Initial sync for both installations
  console.log("Performing initial sync for both installations...");
  await receiverClient.conversations.sync();
  await senderClient.conversations.sync();

  void logAgentDetails([receiverClient, senderClient]);
  // Start installation A (receiver) - handles message streams and periodic processing
  void startReceiverInstallation(receiverClient);
  // Start installation B (sender) - only syncs and sends queued messages
  startSenderInstallation(senderClient);

  process.stdin.resume(); // Keep process running
}

async function startReceiverInstallation(client: Client): Promise<void> {
  console.log("Starting Installation A (receiver)...");

  // Set up periodic sync every 60 seconds
  setInterval(() => {
    void syncConversations(client, "Installation A");
  }, SYNC_INTERVAL);

  try {
    // Start DM and Group message streams
    await setupMessageStreams(client);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in Installation A:", errorMessage);

    // Restart receiver after delay on error
    setTimeout(() => {
      void startReceiverInstallation(client);
    }, 5000);
  }
}

async function setupMessageStreams(client: Client): Promise<void> {
  console.log("Setting up message streams...");

  // Start message stream for all conversations (both DMs and Groups)
  const stream = await client.conversations.streamAllMessages();
  console.log("Message stream started successfully");

  // Process incoming messages
  for await (const message of stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
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
      priority: 1,
      timestamp: Date.now(),
    });

    console.log(`Queued response for conversation ${message.conversationId}`);
  }
}

function startSenderInstallation(client: Client): void {
  console.log("Starting Installation B (sender)...");

  // Periodic sync every 60 seconds
  setInterval(() => {
    void syncConversations(client, "Installation B");
  }, SYNC_INTERVAL);

  // Process message queue every 5 seconds
  setInterval(() => {
    void processMessageQueue(client);
  }, 1000);
}

async function syncConversations(
  client: Client,
  installation: string,
): Promise<void> {
  try {
    console.log(`Syncing conversations for ${installation}...`);
    await client.conversations.sync();
    console.log(`${installation} sync completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${installation} sync error:`, errorMessage);
  }
}

async function processMessageQueue(client: Client): Promise<void> {
  if (messageQueue.length === 0) return;

  // Sort by priority, then by timestamp
  messageQueue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return a.timestamp - b.timestamp;
  });

  // Get highest priority message
  const message = messageQueue.shift();
  if (!message) return;

  try {
    console.log(
      `Installation B sending message for conversation ${message.conversationId}`,
    );
    await client.conversations.sync();
    // Get conversation
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Conversation not found, discarding message");
      throw new Error("Conversation not found");
    }

    // Send message with actual content from queue
    await conversation.send(message.content);
    console.log(`Message sent successfully: "${message.content}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending message:", errorMessage);

    // Put the message back in the queue to try again later
    messageQueue.push(message);
  }
}

// Start the application
void main();
