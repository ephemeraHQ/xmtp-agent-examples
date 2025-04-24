import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
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

// Sync interval in milliseconds
const SYNC_INTERVAL = 500; // 0.5 seconds

async function main(): Promise<void> {
  console.log("Starting XMTP Agent...");

  if (!WALLET_KEY || !ENCRYPTION_KEY || !XMTP_ENV) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Create wallet signer and encryption key
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Create receiver client (handles syncing and message streaming)
  const receiverClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    dbPath: `xmtp-receiver-${XMTP_ENV}.db3`,
  });
  logAgentDetails(receiverClient);

  // Create sender client (only for sending messages)
  const senderClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    dbPath: `xmtp-sender-${XMTP_ENV}.db3`,
  });

  // Initial sync for both clients
  console.log("Performing initial sync...");
  await receiverClient.conversations.sync();
  await senderClient.conversations.sync();

  // Start receiver - syncs and listens for new messages
  void startReceiver(receiverClient);

  // Start sender - only sends queued messages (no sync, no stream)
  startSender(senderClient);

  process.stdin.resume(); // Keep process running
}

async function startReceiver(receiverClient: Client): Promise<void> {
  console.log("Starting receiver...");

  // Set up periodic sync
  const syncIntervalId = setInterval(() => {
    void sync(receiverClient);
  }, SYNC_INTERVAL);

  try {
    // Start message stream
    const stream = await receiverClient.conversations.streamAllMessages();
    console.log("Message stream started successfully");

    // Process incoming messages
    for await (const message of stream) {
      /* Ignore messages from the same agent or non-text messages */
      if (
        message?.senderInboxId.toLowerCase() ===
          receiverClient.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== "text"
      ) {
        continue;
      }

      console.log(`Received: ${message.content as string}`);

      // Queue response
      const response = `Reply to: "${message.content as string}" at ${new Date().toISOString()}`;

      messageQueue.push({
        conversationId: message.conversationId,
        content: response,
        priority: 1,
        timestamp: Date.now(),
      });

      console.log(`Queued response for conversation ${message.conversationId}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in receiver stream:", errorMessage);

    // Clear the interval before restarting
    clearInterval(syncIntervalId);

    // Restart receiver after delay on error
    setTimeout(() => {
      void startReceiver(receiverClient);
    }, SYNC_INTERVAL);
  }
}

function startSender(client: Client): void {
  console.log("Starting sender (send-only mode)...");

  // Process queue every 5 seconds and sync the sender client
  setInterval(() => {
    void sync(client);
    void processMessageQueue(client);
  }, SYNC_INTERVAL);
}

async function sync(client: Client): Promise<void> {
  try {
    await client.conversations.sync();
    console.log("sync completed");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Sender sync error:", errorMessage);
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
    console.log(`Sending message for conversation ${message.conversationId}`);

    // Get conversation
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Conversation not found, discarding message");
      return;
    }

    // Send message with actual content from queue
    await conversation.send(message.content);
    console.log(`Message sent successfully: "${message.content}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing message:", errorMessage);

    // Put the message back in the queue to try again later
    messageQueue.push(message);
  }
}

// Start the application
void main();
