import { Agent, filter, MessageFilter, withFilter, type AgentContext } from "@xmtp/agent-sdk";
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

const agent = await Agent.create(undefined, {
  codecs: [new ActionsCodec(), new IntentCodec()],
});

/**
 * Check if this is the first interaction with a user
 */
const hasSentBefore = async (ctx: AgentContext) => {
  const messages = await ctx.conversation.messages();
  const hasSentBefore = messages.some(
    (msg) =>
      msg.senderInboxId.toLowerCase() === ctx.client.inboxId.toLowerCase(),
  );
  return hasSentBefore;
};

const wasMemberBefore <ContentTypes>(): MessageFilter<ContentTypes> { 
  const members = await ctx.conversation.members();}

  const wasMemberBefore = members.some(
    (member: { inboxId: string; installationIds: string[] }) =>
      member.inboxId.toLowerCase() === ctx.client.inboxId.toLowerCase() &&
      member.installationIds.length > 1,
  );}
  return wasMemberBefore;
};}

// Combination of filters

const combined = filter.and(filter.textOnly);

agent.on(
  "message",
  withFilter(combined, async (ctx) => {
    if (ctx.message.contentType?.typeId === "intent") {
      // Handle action button clicks
      await handleIntentMessage(ctx, ctx.message.content as IntentContent);
    } else {
      await sendWelcomeWithActions(ctx);
    }
  }),
);

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online\nAddress: ${address}\nURL: ${url}`);
});

void agent.start();
