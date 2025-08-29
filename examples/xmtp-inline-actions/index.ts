import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import {
  handleIntentMessage,
  handleTextMessage,
} from "./handlers/messageHandlers";
import { TokenHandler } from "./handlers/tokenHandler";
import {
  handleTransactionReference,
  type ExtendedTransactionReference,
} from "./handlers/transactionHandlers";
import { ActionsCodec } from "./types/ActionsContent";
import { IntentCodec, type IntentContent } from "./types/IntentContent";

async function main() {
  // Initialize token handler
  const tokenHandler = new TokenHandler(
    process.env.NETWORK_ID || "base-sepolia",
  );
  console.log(`📡 Connected to network: ${tokenHandler.getNetworkInfo().name}`);
  console.log(
    `💰 Supported tokens: ${tokenHandler.getSupportedTokens().join(", ")}`,
  );

  const client = await Client.create(undefined, {
    codecs: [
      new WalletSendCallsCodec(),
      new TransactionReferenceCodec(),
      new ActionsCodec(),
      new IntentCodec(),
    ],
  });

  for await (const message of stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    if (
      message.contentType?.typeId !== "text" &&
      message.contentType?.typeId !== "transactionReference" &&
      message.contentType?.typeId !== "intent"
    ) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

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
    if (message.contentType.typeId === "text") {
      await handleTextMessage(
        conversation,
        message.content as string,
        senderAddress,
        agentAddress,
        tokenHandler,
      );
    } else if (message.contentType.typeId === "transactionReference") {
      console.log("🧾 Detected transaction reference message");
      console.log(
        "📋 Raw message content:",
        JSON.stringify(message.content, null, 2),
      );
      await handleTransactionReference(
        conversation,
        message.content as ExtendedTransactionReference,
        senderAddress,
        tokenHandler,
      );
    } else {
      // This must be an intent message since we filtered for text, transactionReference, and intent
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
    }
  }
}

main().catch(console.error);
