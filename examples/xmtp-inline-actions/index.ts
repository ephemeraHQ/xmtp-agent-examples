import { Agent, filter, getTestUrl, withFilter } from "@xmtp/agent-sdk";
import {
  ActionBuilder,
  inlineActionsMiddleware,
  registerAction,
  sendActions,
  sendConfirmation,
  sendSelection,
} from "../../utils/inline-actions/inline-actions";
import { ActionsCodec } from "../../utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "../../utils/inline-actions/types/IntentContent";

process.loadEnvFile(".env");

// Create agent with inline actions support
const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ActionsCodec(), new IntentCodec()],
});

// Add the inline actions middleware
agent.use(inlineActionsMiddleware);

registerAction("send-money", async (ctx) => {
  await sendSelection(ctx, "💸 How much would you like to send?", [
    { id: "send-small", label: "0.01 USDC" },
    { id: "send-medium", label: "0.1 USDC" },
    { id: "send-large", label: "1 USDC" },
  ]);
});

registerAction("send-small", async (ctx) => {
  await sendConfirmation(
    ctx,
    "Send 0.01 USDC to the bot?",
    "confirm-send-small",
    "cancel-send",
  );
});

registerAction("send-medium", async (ctx) => {
  await sendConfirmation(
    ctx,
    "Send 0.1 USDC to the bot?",
    "confirm-send-medium",
    "cancel-send",
  );
});

registerAction("send-large", async (ctx) => {
  await sendConfirmation(
    ctx,
    "Send 1 USDC to the bot?",
    "confirm-send-large",
    "cancel-send",
  );
});

registerAction("confirm-send-small", async (ctx) => {
  await ctx.conversation.send(
    "✅ Small transaction confirmed! (This would create a transaction for 0.01 USDC)",
  );
});

registerAction("confirm-send-medium", async (ctx) => {
  await ctx.conversation.send(
    "✅ Medium transaction confirmed! (This would create a transaction for 0.1 USDC)",
  );
});

registerAction("confirm-send-large", async (ctx) => {
  await ctx.conversation.send(
    "✅ Large transaction confirmed! (This would create a transaction for 1 USDC)",
  );
});

registerAction("cancel-send", async (ctx) => {
  await ctx.conversation.send("❌ Transaction cancelled.");
});

registerAction("check-balance", async (ctx) => {
  await ctx.conversation.send(
    "💰 Bot Balance: 5.25 USDC\n(This is a mock balance)",
  );
});

agent.on(
  "text",
  withFilter(filter.startsWith("menu"), async (ctx) => {
    const menu = ActionBuilder.create(
      "main-menu",
      "🎯 What would you like to do?",
    )
      .add("send-money", "💸 Send Money")
      .add("check-balance", "💰 Check Balance")
      .build();

    await sendActions(ctx, menu);
  }),
);

agent.on("unhandledMessage", (ctx) => {
  console.log(`Unhandled message: ${ctx.message.content}`);
});
agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
  console.log("💡 Send 'menu' to begin!");
});

await agent.start();
