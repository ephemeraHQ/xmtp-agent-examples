import "dotenv/config";
import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "../../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath(env + "-" + signerIdentifier),
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
  });
  void logAgentDetails(client);

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Starting message stream with comprehensive callback logging...");
  console.log("=".repeat(60));
  console.log("📋 Configuration:");
  console.log("   • Retry attempts: 3 (default: 6)");
  console.log("   • Retry delay: 5000ms (default: 10000ms)");
  console.log("   • Retry enabled: true");
  console.log("   • All callbacks: enabled with logging");
  console.log("=".repeat(60));

  const stream = await client.conversations.streamAllMessages({
    // Configure retry behavior
    retryAttempts: 3, // Custom retry attempts (default: 6)
    retryDelay: 5000, // Custom retry delay in ms (default: 10000)
    retryOnFail: true, // Enable/disable retry (default: true)

    // Callback when a value is emitted from the stream
    onValue: async (message) => {
      console.log("📨 onValue callback triggered");
      console.log(`   Message from: ${message.senderInboxId}`);
      console.log(`   Content: ${message.content as string}`);

      if (
        message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message.contentType?.typeId !== "text"
      ) {
        console.log("   ⏭️  Skipping message (from self or non-text)");
        return;
      }

      console.log("   ✅ Processing message...");
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("   ❌ Conversation not found, skipping");
        return;
      }

      console.log("   💬 Sending response...");
      await conversation.send("gm");
      console.log("   ✅ Response sent successfully");
    },

    // Callback when a stream error occurs
    onError: (error) => {
      console.log("🚨 onError callback triggered");
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
      // Note: Stream continues running after error
    },

    // Callback when the stream fails (before retry)
    onFail: () => {
      console.log("💥 onFail callback triggered");
      console.log("   Stream failed, retry will be attempted...");
    },

    // Callback when the stream is retried
    onRetry: (attempts, maxAttempts) => {
      console.log("🔄 onRetry callback triggered");
      console.log(`   Retry attempt: ${attempts}/${maxAttempts}`);
      console.log(`   Waiting 5000ms before retry...`);
    },

    // Callback when the stream is restarted
    onRestart: () => {
      console.log("🔄 onRestart callback triggered");
      console.log("   Stream has been restarted successfully");
    },

    // Callback when the stream ends
    onEnd: () => {
      console.log("🏁 onEnd callback triggered");
      console.log("   Stream has ended");
    },
  });

  console.log("Stream started successfully!");
  console.log("Waiting for messages...");
  console.log("=".repeat(60));
  console.log("💡 Try sending a message to see the callbacks in action!");
  console.log("💡 You can also simulate network issues to see retry behavior");
  console.log("=".repeat(60));
}

main().catch(console.error);
