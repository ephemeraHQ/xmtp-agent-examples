import { Agent as XmtpAgent } from "@xmtp/agent-sdk";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
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

// Initialize token handler
const tokenHandler = new TokenHandler(process.env.NETWORK_ID || "base-sepolia");
console.log(`📡 Connected to network: ${tokenHandler.getNetworkInfo().name}`);
console.log(
  `💰 Supported tokens: ${tokenHandler.getSupportedTokens().join(", ")}`,
);

const agent = await XmtpAgent.create(undefined, {
  codecs: [
    new WalletSendCallsCodec(),
    new TransactionReferenceCodec(),
    new ActionsCodec(),
    new IntentCodec(),
  ],
});

agent.on("message", async (ctx) => {
  const message = ctx.message;

  if (
    message.contentType?.typeId !== "text" &&
    message.contentType?.typeId !== "transactionReference" &&
    message.contentType?.typeId !== "intent"
  ) {
    return;
  }

  console.log(
    `Received message: ${message.content as string} by ${message.senderInboxId}`,
  );

  // Get sender address
  const inboxState = await agent.client.preferences.inboxStateFromInboxIds([
    message.senderInboxId,
  ]);
  const senderAddress = inboxState[0]?.identifiers[0]?.identifier;

  if (!senderAddress) {
    console.log("❌ Unable to find sender address, skipping");
    return;
  }

  // Handle different message types
  if (message.contentType.typeId === "text") {
    await handleTextMessage(
      ctx.conversation,
      message.content as string,
      senderAddress,
      agent.client.accountIdentifier?.identifier || "",
      tokenHandler,
    );
  } else if (message.contentType.typeId === "transactionReference") {
    console.log("🧾 Detected transaction reference message");
    console.log(
      "📋 Raw message content:",
      JSON.stringify(message.content, null, 2),
    );
    await handleTransactionReference(
      ctx.conversation,
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
      ctx.conversation,
      message.content as IntentContent,
      senderAddress,
      agent.client.accountIdentifier?.identifier || "",
      tokenHandler,
    );
  }
});

void agent.start();
