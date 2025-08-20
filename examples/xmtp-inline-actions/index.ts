import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import {
  TransactionReferenceCodec,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import {
  handleIntentMessage,
  handleTextMessage,
} from "./handlers/messageHandlers";
import { TokenHandler } from "./handlers/tokenHandler";
import { handleTransactionReference } from "./handlers/transactionHandlers";
import { ActionsCodec } from "./types/ActionsContent";
import { IntentCodec, type IntentContent } from "./types/IntentContent";

// Validate required environment variables
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV, NETWORK_ID } =
  validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "XMTP_ENV",
    "NETWORK_ID",
  ]);

async function main() {
  console.log("🚀 Starting TBA Chat Example Bot...");

  // Initialize token handler
  const tokenHandler = new TokenHandler(NETWORK_ID);
  console.log(`📡 Connected to network: ${tokenHandler.getNetworkInfo().name}`);
  console.log(
    `💰 Supported tokens: ${tokenHandler.getSupportedTokens().join(", ")}`,
  );

  // Create XMTP client
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    codecs: [
      new WalletSendCallsCodec(),
      new TransactionReferenceCodec(),
      new ActionsCodec(),
      new IntentCodec(),
    ],
  });

  const identifier = await signer.getIdentifier();
  const agentAddress = identifier.identifier;

  void logAgentDetails(client as Client);

  // Sync conversations
  console.log("🔄 Syncing conversations...");
  await client.conversations.sync();

  console.log("👂 Listening for messages...");

  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    try {
      // Skip messages from the agent itself
      if (
        message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()
      ) {
        continue;
      }

      console.log(
        `📨 Received: ${message.contentType?.typeId} from ${message.senderInboxId}`,
      );

      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("❌ Unable to find conversation, skipping");
        continue;
      }

      // Get sender address
      const inboxState = await client.preferences.inboxStateFromInboxIds([
        message.senderInboxId,
      ]);
      const senderAddress = inboxState[0]?.identifiers[0]?.identifier;

      if (!senderAddress) {
        console.log("❌ Unable to find sender address, skipping");
        continue;
      }

      // Handle different message types
      if (message.contentType?.typeId === "text") {
        await handleTextMessage(
          conversation,
          message.content as string,
          senderAddress,
          agentAddress,
          tokenHandler,
        );
      } else if (message.contentType?.typeId === "transactionReference") {
        console.log("🧾 Detected transaction reference message");
        console.log(
          "📋 Raw message content:",
          JSON.stringify(message.content, null, 2),
        );
        await handleTransactionReference(
          conversation,
          message.content as TransactionReference,
          senderAddress,
          tokenHandler,
        );
      } else if (message.contentType?.typeId === "intent") {
        console.log("🎯 Detected intent message");
        console.log(
          "📋 Raw intent content:",
          JSON.stringify(message.content, null, 2),
        );
        await handleIntentMessage(
          conversation,
          message.content as IntentContent,
          senderAddress,
          agentAddress,
          tokenHandler,
        );
      } else {
        continue;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Error in main loop:", errorMessage);
    }
  }
}

main().catch(console.error);
