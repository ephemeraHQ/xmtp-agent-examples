import { validateEnvironment } from "@helpers/client";
import type { DecodedMessage, XmtpEnv } from "@xmtp/node-sdk";
import {
  createXmtpWorkers,
  type WorkerConfig,
  type WorkerInstance,
} from "./workers";

// Validate environment variables for all agents
const {
  XMTP_ENV,
  WALLET_KEY_AGENT1,
  ENCRYPTION_KEY_AGENT1,
  WALLET_KEY_AGENT2,
  ENCRYPTION_KEY_AGENT2,
  WALLET_KEY_AGENT3,
  ENCRYPTION_KEY_AGENT3,
} = validateEnvironment([
  "XMTP_ENV",
  "WALLET_KEY_AGENT1",
  "ENCRYPTION_KEY_AGENT1",
  "WALLET_KEY_AGENT2",
  "ENCRYPTION_KEY_AGENT2",
  "WALLET_KEY_AGENT3",
  "ENCRYPTION_KEY_AGENT3",
]);

/**
 * Message handler function for "gm" responses
 */
async function gmMessageHandler(
  worker: WorkerInstance,
  message: DecodedMessage,
): Promise<void> {
  try {
    // Get the conversation for this message
    const conversation = await worker.client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log(`[${worker.name}] Unable to find conversation, skipping`);
      return;
    }

    // Get the address from the inbox ID
    const inboxState = await worker.client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);

    const addressFromInboxId =
      inboxState[0]?.identifiers[0]?.identifier || "unknown";

    // Log the incoming message
    console.log(
      `[${worker.name}] Received message from ${addressFromInboxId}:`,
    );
    console.log(`Content: ${message.content as string}`);

    // Send "gm" response
    console.log(
      `[${worker.name}] Sending "gm" response to ${addressFromInboxId}...`,
    );
    await conversation.send(`gm from ${worker.name}`);

    console.log(`[${worker.name}] Response sent, waiting for more messages...`);
  } catch (error) {
    console.error(`[${worker.name}] Error handling message:`, error);
  }
}

/**
 * Main function to set up and run parallel GM workers
 */
async function main(): Promise<void> {
  // Create worker configurations
  const workerConfigs: WorkerConfig[] = [
    {
      name: "agent1",
      walletKey: WALLET_KEY_AGENT1,
      encryptionKey: ENCRYPTION_KEY_AGENT1,
      xmtpEnv: XMTP_ENV as XmtpEnv,
    },
    {
      name: "agent2",
      walletKey: WALLET_KEY_AGENT2,
      encryptionKey: ENCRYPTION_KEY_AGENT2,
      xmtpEnv: XMTP_ENV as XmtpEnv,
    },
    {
      name: "agent3",
      walletKey: WALLET_KEY_AGENT3,
      encryptionKey: ENCRYPTION_KEY_AGENT3,
      xmtpEnv: XMTP_ENV as XmtpEnv,
    },
  ];

  // Create worker manager and initialize workers
  console.log("Initializing XMTP client workers...");
  const workers = await createXmtpWorkers(workerConfigs);

  try {
    // Start message streams for all workers
    console.log("Starting message streams for all workers...");

    await Promise.all([
      workers.startMessageStream("agent1", gmMessageHandler),
      workers.startMessageStream("agent2", gmMessageHandler),
      workers.startMessageStream("agent3", gmMessageHandler),
    ]);

    console.log("All workers initialized and listening for messages");

    // Keep the application running
    await new Promise(() => {
      // This promise intentionally never resolves
      // The application will run until terminated
    });
  } catch (error) {
    console.error(
      "Error during worker operation:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    // Ensure proper cleanup on exit
    await workers.terminateAll();
  }
}

// Run the main function
main().catch(console.error);
