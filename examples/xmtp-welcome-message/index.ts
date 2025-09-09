import {
  Agent,
  createSigner,
  createUser,
  getTestUrl,
  type AgentContext,
} from "@xmtp/agent-sdk";
import { formatPrice, formatPriceChange, getCurrentPrice } from "./ethPrice";
import {
  ActionsCodec,
  ContentTypeActions,
  type ActionsContent,
} from "./types/ActionsContent";
import { IntentCodec, type IntentContent } from "./types/IntentContent";

process.loadEnvFile(".env");

/**
 * Send a welcome message with inline actions for ETH price
 */
async function sendWelcomeWithActions(ctx: AgentContext) {
  const welcomeActions: ActionsContent = {
    id: `welcome-${Date.now()}`,
    description: `👋 Welcome! I'm your ETH price agent.

I can help you stay updated with the latest Ethereum price information. Choose an option below to get started:`,
    actions: [
      {
        id: "get-current-price",
        label: "💰 Get Current ETH Price",
        style: "primary",
      },
      {
        id: "get-price-chart",
        label: "📊 Get Price with 24h Change",
        style: "secondary",
      },
    ],
  };

  console.log(`✓ Sending welcome message with actions`);
  await ctx.conversation.send(welcomeActions, ContentTypeActions);
}

/**
 * Handle intent messages (when users click action buttons)
 */
async function handleIntentMessage(
  ctx: AgentContext,
  intentContent: IntentContent,
) {
  console.log(
    `🎯 Processing intent: ${intentContent.actionId} for actions: ${intentContent.id}`,
  );

  try {
    switch (intentContent.actionId) {
      case "get-current-price":
        console.log("💰 Processing current ETH price request");
        await handleCurrentPrice(ctx);
        break;

      case "get-price-chart":
        console.log("📊 Processing ETH price with 24h change request");
        await handlePriceWithChange(ctx);
        break;

      default:
        await ctx.conversation.send(
          `❌ Unknown action: ${intentContent.actionId}`,
        );
        console.log(`❌ Unknown action ID: ${intentContent.actionId}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error processing intent:", errorMessage);
    await ctx.conversation.send(`❌ Error processing action: ${errorMessage}`);
  }
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
 * Check if this is the first interaction with a user
 */
async function isFirstTimeInteraction(ctx: AgentContext): Promise<boolean> {
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

    return !hasSentBefore && !wasMemberBefore;
  } catch (error) {
    console.error("Error checking message history:", error);
    return false;
  }
}
const agent = await Agent.create(createSigner(createUser()), {
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ActionsCodec(), new IntentCodec()],
});

// Handle first-time user messages - send welcome with actions
agent.on("text", async (ctx) => {
  if (await isFirstTimeInteraction(ctx)) {
    await sendWelcomeWithActions(ctx);
  } else {
    await ctx.conversation.send(
      "Hey, we already talked before, so, no welcome message for you",
    );
  }
});

// Handle intent messages (action button clicks) - no filtering needed
agent.on("text", async (ctx) => {
  if (ctx.message.contentType?.typeId === "intent") {
    const messageContent = ctx.message.content as unknown as IntentContent;
    await handleIntentMessage(ctx, messageContent);
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

void agent.start();
