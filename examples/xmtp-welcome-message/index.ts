import {
  Agent,
  getTestUrl,
  type AgentContext,
  type AgentMiddleware,
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

process.loadEnvFile(".env");

// Extend the AgentContext type to include our custom property
interface ExtendedAgentContext extends AgentContext {
  isFirstTime?: boolean;
}

/**
 * Send a welcome message with inline actions for ETH price
 */
async function sendWelcomeWithActions(ctx: AgentContext) {
  const welcomeActions = ActionBuilder.create(
    `welcome-${Date.now()}`,
    `👋 Welcome! I'm your ETH price agent.

I can help you stay updated with the latest Ethereum price information. Choose an option below to get started:`,
  )
    .addPrimaryAction("get-current-price", "💰 Get Current ETH Price")
    .addSecondaryAction("get-price-chart", "📊 Get Price with 24h Change")
    .build();

  console.log(`✓ Sending welcome message with actions`);
  await sendActions(ctx, welcomeActions);
}

/**
 * Handle current ETH price request
 */
async function handleCurrentPrice(ctx: AgentContext) {
  try {
    await ctx.conversation.send("⏳ Fetching current ETH price...");

    const { price } = await getCurrentPrice();
    const formattedPrice = formatPrice(price);

    await ctx.conversation.send(`💰 **Current ETH Price**

${formattedPrice}

Data provided by CoinGecko 📈`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.conversation.send(
      `❌ Failed to fetch ETH price: ${errorMessage}`,
    );
  }
}

/**
 * Handle ETH price with 24h change request
 */
async function handlePriceWithChange(ctx: AgentContext) {
  try {
    await ctx.conversation.send("⏳ Fetching ETH price with 24h change...");

    const { price, change24h } = await getCurrentPrice();
    const formattedPrice = formatPrice(price);
    const formattedChange = formatPriceChange(change24h);

    await ctx.conversation.send(`📊 **ETH Price with 24h Change**

**Current Price:** ${formattedPrice}
**24h Change:** ${formattedChange}

Data provided by CoinGecko 📈`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.conversation.send(
      `❌ Failed to fetch ETH price: ${errorMessage}`,
    );
  }
}

/**
 * Middleware to detect first-time interactions and add flag to context
 */
const firstTimeInteractionMiddleware: AgentMiddleware = async (ctx, next) => {
  try {
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
      return;
    }
  } catch (error) {
    console.error("Error checking message history:", error);
    (ctx as ExtendedAgentContext).isFirstTime = false;
  }

  await next();
};

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ActionsCodec(), new IntentCodec()],
});

// Add middleware
agent.use(firstTimeInteractionMiddleware);
agent.use(inlineActionsMiddleware);

// Register action handlers using the utilities
registerAction("get-current-price", handleCurrentPrice);
registerAction("get-price-chart", handlePriceWithChange);

agent.on("unhandledError", (error) => {
  console.error("Agent error", error);
});

// Handle first-time user messages - send welcome with actions
agent.on("text", async (ctx) => {
  await sendWelcomeWithActions(ctx);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

void agent.start();
