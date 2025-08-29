import { filter, withFilter, Agent as XmtpAgent } from "@xmtp/agent-sdk";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import {
  handleActionsCommand,
  handleActionsWithImagesCommand,
  handleHelpCommand,
} from "./handlers/actionHandlers";
import {
  handleBalanceCommand,
  handleInfoCommand,
  handleIntentMessage,
  handleSendCommand,
} from "./handlers/messageHandlers";
import { TokenHandler } from "./handlers/tokenHandler";
import {
  handleTransactionReference,
  type ExtendedTransactionReference,
} from "./handlers/transactionHandlers";
import { ActionsCodec } from "./types/ActionsContent";
import { IntentCodec, type IntentContent } from "./types/IntentContent";

process.loadEnvFile(".env");

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

// Commands
agent.on(
  "message",
  withFilter(filter.startsWith("/help"), async (ctx) => {
    await handleHelpCommand(ctx, tokenHandler);
  }),
);

agent.on(
  "message",
  withFilter(filter.startsWith("/actions"), async (ctx) => {
    await handleActionsCommand(ctx);
  }),
);

agent.on(
  "message",
  withFilter(filter.startsWith("/actions-with-images"), async (ctx) => {
    await handleActionsWithImagesCommand(ctx);
  }),
);

agent.on(
  "message",
  withFilter(filter.startsWith("/send"), async (ctx) => {
    await handleSendCommand(
      ctx.conversation,
      ctx.message.content as string,
      ctx.message.senderInboxId,
      agent.client.accountIdentifier?.identifier || "",
      tokenHandler,
    );
  }),
);

agent.on(
  "message",
  withFilter(filter.startsWith("/balance"), async (ctx) => {
    await handleBalanceCommand(
      ctx.conversation,
      ctx.message.content as string,
      agent.client.accountIdentifier?.identifier || "",
      tokenHandler,
    );
  }),
);

agent.on(
  "message",
  withFilter(filter.startsWith("/info"), async (ctx) => {
    await handleInfoCommand(ctx.conversation, tokenHandler);
  }),
);

agent.on("message", async (ctx) => {
  const message = ctx.message;

  // Get sender address
  const inboxState = await agent.client.preferences.inboxStateFromInboxIds([
    message.senderInboxId,
  ]);
  const senderAddress = inboxState[0]?.identifiers[0]?.identifier;

  if (!senderAddress) {
    console.log("❌ Unable to find sender address, skipping");
    return;
  }

  if (message.contentType?.typeId === "transactionReference") {
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
  } else if (message.contentType?.typeId === "intent") {
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
  } else {
    await ctx.conversation.send("👋 Type '/help' to see available options!");
  }
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online\nAddress: ${address}\nURL: ${url}`);
});

void agent.start();
