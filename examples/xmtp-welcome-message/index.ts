import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type GroupMember,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { formatPrice, formatPriceChange, getCurrentPrice } from "./ethPrice";
import {
  ActionsCodec,
  ContentTypeActions,
  type ActionsContent,
} from "./types/ActionsContent";
import { IntentCodec, type IntentContent } from "./types/IntentContent";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/**
 * Send a welcome message with inline actions for ETH price
 */
async function sendWelcomeWithActions(
  conversation: Conversation,
  _client: Client,
) {
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
  await conversation.send(welcomeActions, ContentTypeActions);
}

/**
 * Check if this is the first interaction with a user
 */
async function isFirstTimeInteraction(
  conversation: Conversation,
  client: Client,
): Promise<boolean> {
  try {
    const messages = await conversation.messages();
    const hasSentBefore = messages.some(
      (msg) => msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
    );
    const members = await conversation.members();
    const wasMemberBefore = members.some(
      (member: GroupMember) =>
        member.inboxId.toLowerCase() === client.inboxId.toLowerCase() &&
        member.installationIds.length > 1,
    );

    return !hasSentBefore && !wasMemberBefore;
  } catch (error) {
    console.error("Error checking message history:", error);
    return false;
  }
}

/**
 * Handle intent messages (when users click action buttons)
 */
async function handleIntentMessage(
  conversation: Conversation,
  intentContent: IntentContent,
  _client: Client,
) {
  console.log(
    `🎯 Processing intent: ${intentContent.actionId} for actions: ${intentContent.id}`,
  );

  try {
    switch (intentContent.actionId) {
      case "get-current-price":
        console.log("💰 Processing current ETH price request");
        await handleCurrentPrice(conversation);
        break;

      case "get-price-chart":
        console.log("📊 Processing ETH price with 24h change request");
        await handlePriceWithChange(conversation);
        break;

      default:
        await conversation.send(`❌ Unknown action: ${intentContent.actionId}`);
        console.log(`❌ Unknown action ID: ${intentContent.actionId}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error processing intent:", errorMessage);
    await conversation.send(`❌ Error processing action: ${errorMessage}`);
  }
}

/**
 * Handle current ETH price request
 */
async function handleCurrentPrice(conversation: Conversation) {
  try {
    await conversation.send("⏳ Fetching current ETH price...");

    const { price } = await getCurrentPrice();
    const formattedPrice = formatPrice(price);

    await conversation.send(`💰 **Current ETH Price**

${formattedPrice}

Data provided by CoinGecko 📈`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await conversation.send(`❌ Failed to fetch ETH price: ${errorMessage}`);
  }
}

/**
 * Handle ETH price with 24h change request
 */
async function handlePriceWithChange(conversation: Conversation) {
  try {
    await conversation.send("⏳ Fetching ETH price with 24h change...");

    const { price, change24h } = await getCurrentPrice();
    const formattedPrice = formatPrice(price);
    const formattedChange = formatPriceChange(change24h);

    await conversation.send(`📊 **ETH Price with 24h Change**

**Current Price:** ${formattedPrice}
**24h Change:** ${formattedChange}

Data provided by CoinGecko 📈`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await conversation.send(`❌ Failed to fetch ETH price: ${errorMessage}`);
  }
}

/**
 * Handle incoming messages with contextual responses
 */
async function handleMessage(message: DecodedMessage, client: Client) {
  try {
    // Skip messages from the agent itself
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      return;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Could not find conversation for message");
      return;
    }

    // Handle different message types
    if (message.contentType?.typeId === "text") {
      const isFirstTime = await isFirstTimeInteraction(conversation, client);

      // Handle first-time interactions with welcome actions
      if (isFirstTime) {
        await sendWelcomeWithActions(conversation, client);
        return;
      }

      // Handle subsequent text messages
      const messageContent = (message.content as string).toLowerCase().trim();
      if (messageContent === "help" || messageContent === "gm") {
        await sendWelcomeWithActions(conversation, client);
      } else {
        await conversation.send("👋 Type 'help' to see available options!");
      }
    } else if (message.contentType?.typeId === "intent") {
      // Handle action button clicks
      await handleIntentMessage(
        conversation,
        message.content as IntentContent,
        client,
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error handling message:", errorMessage);
  }
}

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    codecs: [new ActionsCodec(), new IntentCodec()],
  });

  void logAgentDetails(client as Client);

  // Handle all messages
  const messageStream = await client.conversations.streamAllMessages();
  console.log("🎧 Listening for messages...");

  for await (const message of messageStream) {
    await handleMessage(message as DecodedMessage<string>, client as Client);
  }
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("❌ Agent crashed:", errorMessage);
});
