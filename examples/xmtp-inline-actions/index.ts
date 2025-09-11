import { Agent, getTestUrl } from "@xmtp/agent-sdk";
import {
  ActionBuilder,
  inlineActionsMiddleware,
  registerAction,
  sendActions,
  sendConfirmation,
  sendSelection,
} from "./inlineActionsUtils";
import { ActionsCodec } from "./types/ActionsContent";
import { IntentCodec } from "./types/IntentContent";

process.loadEnvFile(".env");

// Create agent with inline actions support
const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ActionsCodec(), new IntentCodec()],
});

// Add the inline actions middleware
agent.use(inlineActionsMiddleware);

// Register action handlers
registerAction("show-menu", async (ctx) => {
  const menu = ActionBuilder.create(
    "main-menu",
    "🎯 What would you like to do?",
  )
    .addPrimaryAction("send-money", "💸 Send Money")
    .addPrimaryAction("check-balance", "💰 Check Balance")
    .addSecondaryAction("get-help", "❓ Help")
    .build();

  await sendActions(ctx, menu);
});

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

registerAction("get-help", async (ctx) => {
  const help = ActionBuilder.create(
    "help-menu",
    `📚 Help Center

This bot demonstrates inline actions utilities! Here's what you can do:

• Send money with confirmation flows
• Check balances  
• Navigate through action menus

The utilities make it easy to create interactive experiences.`,
  )
    .addSecondaryAction("show-menu", "🔙 Back to Menu")
    .build();

  await sendActions(ctx, help);
});

// Handle text messages
agent.on("text", async (ctx) => {
  const message = ctx.message.content.trim().toLowerCase();

  if (message === "/start" || message === "start" || message === "menu") {
    // Trigger the main menu
    const menuAction = ActionBuilder.create(
      "welcome",
      "👋 Welcome! Let's get started.",
    )
      .addPrimaryAction("show-menu", "🚀 Show Menu")
      .build();

    await sendActions(ctx, menuAction);
  } else {
    await ctx.conversation.send(
      `👋 Hi there! Send "start" or "menu" to see what I can do!`,
    );
  }
});

agent.on("start", () => {
  console.log("🤖 Inline Actions Example Bot Started");
  console.log(`📱 Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗 Test URL: ${getTestUrl(agent)}`);
  console.log("💡 Send 'start' or 'menu' to begin!");
});

await agent.start();
