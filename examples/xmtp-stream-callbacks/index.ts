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

  console.log("Starting message stream with new streaming API...");
  console.log("=".repeat(60));
  console.log("📋 Configuration:");
  console.log("   • Retry attempts: 3 (default: 6)");
  console.log("   • Retry delay: 5000ms (default: 10000ms)");
  console.log("   • Retry enabled: true");
  console.log("   • All callbacks: enabled with logging");
  console.log("=".repeat(60));

  // Example 1: Basic stream with retry configuration
  console.log("\n🚀 Example 1: Basic stream with retry configuration");
  void client.conversations.streamAllMessages({
    // Configure retry behavior
    retryAttempts: 3, // Custom retry attempts (default: 6)
    retryDelay: 5000, // Custom retry delay in ms (default: 10000)
    retryOnFail: true, // Enable/disable retry (default: true)

    // Callback when a value is emitted from the stream
    onValue: (message) => {
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

      // Handle async operations without awaiting in the callback
      client.conversations
        .getConversationById(message.conversationId)
        .then((conversation) => {
          if (!conversation) {
            console.log("   ❌ Conversation not found, skipping");
            return;
          }

          console.log("   💬 Sending response...");
          return conversation.send("gm");
        })
        .then(() => {
          console.log("   ✅ Response sent successfully");
        })
        .catch((error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(`   ❌ Error processing message: ${errorMessage}`);
        });
    },

    // Callback when a stream error occurs (stream continues running)
    onError: (error) => {
      console.log("🚨 onError callback triggered");
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
      console.log("   ℹ️  Stream continues running after error");
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

  // Example 2: Demonstrate different stream types
  console.log("\n🚀 Example 2: Different stream types");

  // Stream only conversations
  const _conversationStream = await client.conversations.stream({
    onValue: (conversation) => {
      console.log(`📞 New conversation: ${conversation?.id || "unknown"}`);
    },
    onError: (error) => {
      console.log(`❌ Conversation stream error: ${error.message}`);
    },
  });

  // Stream only groups
  const _groupStream = await client.conversations.streamGroups({
    onValue: (group) => {
      console.log(`👥 New group: ${group.name || group.id}`);
    },
    onError: (error) => {
      console.log(`❌ Group stream error: ${error.message}`);
    },
  });

  // Stream only DMs
  const _dmStream = await client.conversations.streamDms({
    onValue: (dm) => {
      console.log(`💬 New DM with: ${dm.peerInboxId}`);
    },
    onError: (error) => {
      console.log(`❌ DM stream error: ${error.message}`);
    },
  });

  // Example 3: Disable retry for a stream
  console.log("\n🚀 Example 3: Stream with retry disabled");
  await client.conversations.streamAllMessages({
    retryOnFail: false, // Disable retry
    onValue: (message) => {
      console.log(`📨 Message without retry: ${message.content as string}`);
    },
    onFail: () => {
      console.log("💥 Stream failed and will not retry");
    },
  });

  console.log("All streams started!");
  console.log("=".repeat(60));
  console.log("📚 Migration Notes:");
  console.log("   • All streaming methods are now async");
  console.log("   • Single options object instead of multiple parameters");
  console.log("   • Streams no longer end on error");
  console.log("   • Automatic retry with configurable behavior");
  console.log("   • Improved type safety (values never undefined)");
  console.log("=".repeat(60));
}

main().catch(console.error);
