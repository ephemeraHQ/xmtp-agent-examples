import {
  Agent,
  getTestUrl,
  type AgentMiddleware,
  MessageContext,
} from "@xmtp/agent-sdk";
import {
  ActionBuilder,
  inlineActionsMiddleware,
  registerAction,
  sendActions,
} from "../../utils/inline-actions/inline-actions";
import { ActionsCodec } from "../../utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "../../utils/inline-actions/types/IntentContent";
import { formatPrice, formatPriceChange, getCurrentPrice } from "./ethPrice";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

/**
 * Handle current ETH price request
 */
async function handleCurrentPrice(ctx: MessageContext) {
  try {
    await ctx.sendText("⏳ Fetching current ETH price...");

    const { price } = await getCurrentPrice();
    const formattedPrice = formatPrice(price);

    await ctx.sendText(`
    💰 **Current ETH Price**

    ${formattedPrice}

    Data provided by CoinGecko 📈`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.sendText(`❌ Failed to fetch ETH price: ${errorMessage}`);
  }
}

/**
 * Handle ETH price with 24h change request
 */
async function handlePriceWithChange(ctx: MessageContext) {
  try {
    await ctx.sendText("⏳ Fetching ETH price with 24h change...");

    const { price, change24h } = await getCurrentPrice();
    const formattedPrice = formatPrice(price);
    const formattedChange = formatPriceChange(change24h);

    await ctx.sendText(`📊 **ETH Price with 24h Change**

**Current Price:** ${formattedPrice}
**24h Change:** ${formattedChange}

Data provided by CoinGecko 📈`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.sendText(`❌ Failed to fetch ETH price: ${errorMessage}`);
  }
}

/**
 * Middleware to detect first-time interactions and add flag to context
 */
const firstTimeInteractionMiddleware: AgentMiddleware = async (ctx, next) => {
  const messages = await ctx.conversation.messages();
  const hasSentBefore = messages.some(
    (msg) =>
      msg.senderInboxId.toLowerCase() === ctx.client.inboxId.toLowerCase(),
  );
  const members = await ctx.conversation.members();
  const wasMemberBefore = members.some(
    (member: { inboxId: string; installationIds: string[] }) =>
      member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase() &&
      member.installationIds.length > 1,
  );

  // Add the first-time interaction flag to the context
  if (!hasSentBefore && !wasMemberBefore) {
    console.warn("First time interaction");
  } else {
    console.warn("Not first time interaction");
    // return; to break the middleware chain and prevent the inline actions middleware from being executed
    //return;
  }

  await next();
};

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ActionsCodec(), new IntentCodec()],
});

// Add middleware
agent.use(firstTimeInteractionMiddleware, inlineActionsMiddleware);

// Register action handlers using the utilities
registerAction("get-current-price", handleCurrentPrice);
registerAction("get-price-chart", handlePriceWithChange);

agent.on("unhandledError", (error) => {
  console.error("Agent error", error);
});

// Handle first-time user messages - send welcome with actions
agent.on("text", async (ctx) => {
  if (ctx.isDm()) {
    const welcomeActions = ActionBuilder.create(
      `welcome-${Date.now()}`,
      `👋 Welcome! I'm your ETH price agent.\n\nI can help you stay updated with the latest Ethereum price information. Choose an option below to get started:`,
    )
      .add("get-current-price", "💰 Get Current ETH Price")
      .add("get-price-chart", "📊 Get Price with 24h Change")
      .build();

    console.log(`✓ Sending welcome message with actions`);
    await sendActions(ctx, welcomeActions);
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

void agent.start();
