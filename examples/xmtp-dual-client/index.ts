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

  // Create installation A (receiver) client
  const receiverClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    dbPath: `xmtp-installation-a-${XMTP_ENV}.db3`,
  });
  logAgentDetails(receiverClient);
  console.log("Installation A (receiver) client created");

  // Create installation B (sender) client
  const senderClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    dbPath: `xmtp-installation-b-${XMTP_ENV}.db3`,
  });
  console.log("Installation B (sender) client created");

  // Initial sync for both installations
  console.log("Performing initial sync for both installations...");
  await receiverClient.conversations.sync();
  await senderClient.conversations.sync();

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

  // Set up periodic processing of missed messages every 60 seconds
  setInterval(() => {
    void processMissedMessages(client);
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

async function processMissedMessages(client: Client): Promise<void> {
  console.log("Processing missed messages in Installation A...");

  try {
    // First sync conversations to get the latest state
    await client.conversations.sync();

    // Get all conversations
    const conversations = await client.conversations.list();

    // Check each conversation for recent messages
    for (const conversation of conversations) {
      try {
        // Get latest messages (limit to 10 recent messages)
        const messages = await conversation.messages({ limit: 10 });

        // Filter out messages not from our agent and that are text messages
        const missedMessages = messages.filter(
          (message) =>
            message.senderInboxId.toLowerCase() !==
              client.inboxId.toLowerCase() &&
            message.contentType?.typeId === "text",
        );

        // Process any messages received in the last minute that might have been missed by the stream
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const recentMissedMessages = missedMessages.filter(
          (message) => message.sentAt > oneMinuteAgo,
        );

        for (const message of recentMissedMessages) {
          const content = message.content as string;
          console.log(
            `Found missed message: "${content}" in conversation ${message.conversationId}`,
          );

          // Queue response for missed message
          const response = `Reply to missed message: "${content}" at ${new Date().toISOString()}`;

          messageQueue.push({
            conversationId: message.conversationId,
            content: response,
            priority: 2, // Higher priority for missed messages
            timestamp: Date.now(),
          });

          console.log(
            `Queued response for missed message in conversation ${message.conversationId}`,
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Error processing conversation ${conversation.id}:`,
          errorMessage,
        );
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing missed messages:", errorMessage);
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
  }, 5000);
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
    console.error("Error sending message:", errorMessage);

    // Put the message back in the queue to try again later
    messageQueue.push(message);
  }
}

// Start the application
void main();
