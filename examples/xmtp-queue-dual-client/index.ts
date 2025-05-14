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
  timestamp: number;
}

// Message queue
const messageQueue: QueuedMessage[] = [];

// Queue processing interval in milliseconds (1 second)
const PROCESS_INTERVAL = 1000;

async function main(): Promise<void> {
  console.log("Starting XMTP Queue Agent...");

  // Create wallet signer and encryption key
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Create a single client
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    loggingLevel: LOGGING_LEVEL as LogLevel,
    dbPath: getDbPath(XMTP_ENV),
  });

  console.log("XMTP client created");
  void logAgentDetails(client);

  // Initial sync
  console.log("Performing initial sync...");
  await client.conversations.sync();

  // Start message processor
  startMessageProcessor(client);

  // Start message stream
  void setupMessageStream(client);

  process.stdin.resume(); // Keep process running
}

async function setupMessageStream(client: Client): Promise<void> {
  try {
    console.log("Setting up message stream...");
    const stream = await client.conversations.streamAllMessages();
    console.log("Message stream started successfully");

    // Process incoming messages
    for await (const message of stream) {
      // Ignore messages from self or non-text messages
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
        timestamp: Date.now(),
      });

      console.log(`Queued response for conversation ${message.conversationId}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in message stream:", errorMessage);
  }
}

function startMessageProcessor(client: Client): void {
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

  try {
    // Sync conversations before sending
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending message:", errorMessage);

    // Put the message back in the queue to try again later
    messageQueue.push(message);
  }
}

// Start the application
void main();
