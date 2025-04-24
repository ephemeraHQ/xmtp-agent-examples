import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

// Validate required environment variables
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

// Simple message queue to pass messages between clients
interface QueuedMessage {
  conversationId: string;
  content: string;
  priority: number; // Higher number = higher priority
  timestamp: number;
}

// Message queue
const messageQueue: QueuedMessage[] = [];

// Track the last sync time for each client
const syncTimes = {
  receiver: 0,
  sender: 0,
};

const SYNC_INTERVAL = 60000; // 1 minute in milliseconds

async function main() {
  console.log("Starting XMTP Dual-Client Agent with Message Queue...");

  // Create two separate clients using the same wallet
  // This creates two different installations of the same inbox
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Create receiver client (optimized for streaming/receiving)
  const receiverClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    // Use a unique DB directory for the receiver client
    dbPath: "xmtp-receiver.db3",
  });
  logAgentDetails(receiverClient);

  // Create sender client (optimized for sending)
  console.log("Initializing sender client...");
  const senderClient = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    // Use a unique DB directory for the sender client
    dbPath: "xmtp-sender.db3",
  });

  console.log(
    "Sender client created with installation ID:",
    senderClient.installationId,
  );

  // Initial sync for both clients
  console.log("Performing initial sync for receiver client...");
  await receiverClient.conversations.sync();
  syncTimes.receiver = Date.now();

  console.log("Performing initial sync for sender client...");
  await senderClient.conversations.sync();
  syncTimes.sender = Date.now();

  // Start the receiver process - responsible for streaming messages and queueing responses
  void startReceiverProcess(receiverClient);

  // Start the sender process - responsible for sending queued messages
  startSenderProcess(senderClient);

  // Keep the process running
  process.stdin.resume();
  console.log("Dual-client agent is running. Press Ctrl+C to exit.");
}

async function startReceiverProcess(client: Client) {
  console.log("Starting receiver process...");

  // Start periodic sync for receiver
  startPeriodicSync(client, "receiver");

  // Start streaming messages
  const stream = await client.conversations.streamAllMessages();

  // Process incoming messages
  for await (const message of stream) {
    // Skip messages from ourselves (either client - same inbox ID)
    if (message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    // Only process text messages
    if (message?.contentType?.typeId !== "text") {
      continue;
    }

    try {
      console.log(`[RECEIVER] Received message: ${message.content as string}`);

      // Queue a response for the sender client
      const responseContent = `This is a response to: "${message.content as string}"\nReceived at ${new Date().toISOString()}`;

      // Add message to queue for sender to process
      messageQueue.push({
        conversationId: message.conversationId,
        content: responseContent,
        priority: 1, // Standard priority
        timestamp: Date.now(),
      });

      console.log(
        `[RECEIVER] Queued response for conversation ${message.conversationId}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[RECEIVER] Error processing message:", errorMessage);
    }
  }
}

function startSenderProcess(client: Client) {
  console.log("Starting sender process...");

  // Start periodic sync for sender
  startPeriodicSync(client, "sender");

  // Process the message queue periodically
  setInterval(() => {
    void (async () => {
      if (messageQueue.length === 0) {
        return; // Nothing to send
      }

      // Sort queue by priority (higher first) then by timestamp (older first)
      messageQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // Get the highest priority message
      const nextMessage = messageQueue.shift();
      if (!nextMessage) return;

      try {
        console.log(
          `[SENDER] Processing queued message for conversation ${nextMessage.conversationId}`,
        );

        // Get the conversation
        const conversation = await client.conversations.getConversationById(
          nextMessage.conversationId,
        );

        if (!conversation) {
          console.log(
            "[SENDER] Could not find conversation, discarding message",
          );
          return;
        }

        // Try to send without syncing first
        try {
          await conversation.send(nextMessage.content);
          console.log(
            "[SENDER] Message sent successfully without needing sync",
          );
        } catch {
          // If send fails, try syncing and retry
          console.log("[SENDER] Send failed, attempting to sync and retry");

          // Perform a sync
          await client.conversations.sync();
          syncTimes.sender = Date.now();

          // Retry sending
          await conversation.send(nextMessage.content);
          console.log("[SENDER] Message sent after sync");
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[SENDER] Error sending message:", errorMessage);

        // Re-queue the message with a delay and lower priority
        setTimeout(() => {
          messageQueue.push({
            ...nextMessage,
            priority: Math.max(0, nextMessage.priority - 1), // Lower priority for retries
            timestamp: Date.now(), // Update timestamp
          });
          console.log("[SENDER] Re-queued message for later retry");
        }, 5000);
      }
    })();
  }, 1000); // Check queue every second
}

// Function to perform periodic syncs for a client
function startPeriodicSync(client: Client, clientType: "receiver" | "sender") {
  setInterval(() => {
    void (async () => {
      try {
        if (Date.now() - syncTimes[clientType] >= SYNC_INTERVAL) {
          console.log(
            `[${clientType.toUpperCase()}] Performing periodic sync...`,
          );
          await client.conversations.sync();
          syncTimes[clientType] = Date.now();
          console.log(`[${clientType.toUpperCase()}] Periodic sync complete`);
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[${clientType.toUpperCase()}] Error during periodic sync:`,
          errorMessage,
        );
      }
    })();
  }, 10000); // Check every 10 seconds if sync is needed
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Fatal error:", errorMessage);
  process.exit(1);
});
