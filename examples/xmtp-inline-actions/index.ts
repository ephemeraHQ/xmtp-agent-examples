import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

// Poll options
const POLL_OPTIONS = [
  { id: "pizza", label: "🍕 Pizza" },
  { id: "burgers", label: "🍔 Burgers" },
  { id: "tacos", label: "🌮 Tacos" },
  { id: "sushi", label: "🍣 Sushi" },
];

// Store for tracking sent polls
const sentPolls = new Set<string>();

async function main() {
  // Initialize client
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  // Start listening for messages
  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    console.log("Message:", message);
    // Skip if message is undefined
    if (!message) {
      continue;
    }

    // Ignore messages from the agent itself
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    try {
      // Check if this is an intent response (user selecting an option)
      if (message.contentType?.typeId === "intent") {
        await handleIntentResponse(message, client);
        continue;
      }

      // Handle text messages to trigger polls
      if (message.contentType?.typeId === "text") {
        const messageContent = (message.content as string).toLowerCase();

        // Trigger poll with "poll" or "vote" command
        if (
          messageContent.includes("poll") ||
          messageContent.includes("vote")
        ) {
          await sendPoll(message.conversationId, client);
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing message:", errorMessage);
    }
  }
}

async function sendPoll(conversationId: string, client: Client) {
  try {
    const conversation =
      await client.conversations.getConversationById(conversationId);
    if (!conversation) {
      console.log("Could not find conversation");
      return;
    }

    // Mark this conversation as having a sent poll
    sentPolls.add(conversationId);

    // Create the actions payload
    const actionsPayload = {
      actions: POLL_OPTIONS.map((option) => ({
        type: "action",
        label: option.label,
        intent: option.id,
        description: `Vote for ${option.label}`,
      })),
      title: "🗳️ Food Poll",
      description: "What's your favorite food? Choose an option below:",
    };

    // Create fallback text for clients that don't support inline actions
    const fallbackText = `🗳️ Food Poll - What's your favorite food?

${POLL_OPTIONS.map((option, index) => `[${index + 1}] ${option.label}`).join("\n")}

Reply with the number to select your choice.`;

    // Send the actions message
    // Note: The actual actions payload would need to be properly encoded
    // For this example, we'll use the fallback and simulate the structure
    console.log(`📊 Sending poll to conversation ${conversationId}`);
    console.log("Actions payload:", JSON.stringify(actionsPayload, null, 2));

    // Send as text for now - in a real implementation, you'd use the proper content type
    await conversation.send(fallbackText);

    console.log("✓ Poll sent successfully");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending poll:", errorMessage);
  }
}

async function handleIntentResponse(message: DecodedMessage, client: Client) {
  try {
    const conversationId = message.conversationId;
    const senderInboxId = message.senderInboxId;
    const fallback = (message as { fallback?: string }).fallback || "";

    console.log(`\n🗳️  POLL RESPONSE RECEIVED`);
    console.log(`📍 Conversation: ${conversationId}`);
    console.log(`👤 Sender: ${senderInboxId}`);
    console.log(`📝 Fallback: "${fallback}"`);

    // Parse the selected option from the fallback text
    // Example: "User selected action: pizza"
    const selectedOption = parseSelectedOption(fallback);

    if (selectedOption) {
      const option = POLL_OPTIONS.find((opt) => opt.id === selectedOption);
      console.log(
        `✅ Selected Option: ${selectedOption} (${option?.label || "Unknown"})`,
      );

      // Log detailed vote information
      logVoteDetails(senderInboxId, selectedOption, option?.label);

      // Send confirmation message
      const conversation =
        await client.conversations.getConversationById(conversationId);
      if (conversation) {
        await conversation.send(
          `Thanks for voting! You selected: ${option?.label || selectedOption}`,
        );
      }
    } else {
      console.log(`❌ Could not parse selected option from: "${fallback}"`);
    }

    console.log(`─────────────────────────────────────\n`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error handling intent response:", errorMessage);
  }
}

function parseSelectedOption(fallback: string): string | null {
  // Try to extract the option from different fallback formats

  // Format: "User selected action: pizza"
  const actionMatch = fallback.match(/User selected action:\s*(\w+)/i);
  if (actionMatch) {
    return actionMatch[1];
  }

  // Format: "Selected: pizza"
  const selectedMatch = fallback.match(/Selected:\s*(\w+)/i);
  if (selectedMatch) {
    return selectedMatch[1];
  }

  // Check if any option ID is mentioned in the fallback
  for (const option of POLL_OPTIONS) {
    if (fallback.toLowerCase().includes(option.id)) {
      return option.id;
    }
  }

  return null;
}

function logVoteDetails(
  senderInboxId: string,
  optionId: string,
  optionLabel?: string,
) {
  const timestamp = new Date().toISOString();

  console.log(`\n📊 VOTE LOGGED:`);
  console.log(`   Time: ${timestamp}`);
  console.log(`   Voter: ${senderInboxId}`);
  console.log(`   Choice: ${optionId} (${optionLabel})`);

  // In a real application, you might want to store this in a database
  // For this example, we're just logging to console
}

main().catch(console.error);
