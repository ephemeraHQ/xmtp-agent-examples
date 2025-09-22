import {
  Agent,
  type MessageContext,
  type AgentMiddleware,
} from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";

import { loadEnvFile } from "../../utils/general";

loadEnvFile();
// Configuration for the secret word gated group
const GROUP_CONFIG = {
  // The secret passphrase users must provide to join
  secretWord: process.env.SECRET_WORD,
  // Group details
  groupName: "Secret Word Gated Group",
  groupDescription: "A group that requires a secret passphrase to join",

  // Messages
  messages: {
    welcome:
      "Hi! I can add you to our exclusive group. What's the secret passphrase?",
    success: [
      "🎉 Correct! You've been added to the group.",
      "Welcome to our community!",
      "Please introduce yourself and follow our community guidelines.",
    ],
    alreadyInGroup: "You're already in the group!",
    invalid: "❌ Invalid passphrase. Please try again.",
    error: "Sorry, something went wrong. Please try again.",
    help: "Send me the secret passphrase to join our exclusive group!",
  },
};

// Store to track users who are already in the group
const usersInGroup = new Set<string>();

// Extended context type to include group validation results
interface GroupValidationContext extends MessageContext {
  groupValidation?: {
    isValidPassphrase: boolean;
    isAlreadyInGroup: boolean;
    hasSecretWord: boolean;
  };
}

// Middleware for group code parsing and validation
const groupCodeParser: AgentMiddleware = async (ctx, next) => {
  const senderInboxId = ctx.message.senderInboxId;
  const messageContent = ctx.message.content;
  const secretWord = GROUP_CONFIG.secretWord || "";

  // Check if secret word is configured
  const hasSecretWord = Boolean(secretWord);

  // Check if user is already in the group
  const isAlreadyInGroup = usersInGroup.has(senderInboxId);

  // Check if the message matches the secret word (only for text messages)
  const isValidPassphrase =
    hasSecretWord &&
    typeof messageContent === "string" &&
    messageContent.trim().toLowerCase() === secretWord.toLowerCase();

  // Attach validation results to context
  (ctx as GroupValidationContext).groupValidation = {
    isValidPassphrase,
    isAlreadyInGroup,
    hasSecretWord,
  };

  // Continue to next middleware/handler
  await next();
};

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

// Apply the group code parsing middleware
agent.use(groupCodeParser);

agent.on("text", (ctx) => {
  const validationCtx = ctx as GroupValidationContext;
  const validation = validationCtx.groupValidation;

  // Check if validation data is available
  if (!validation) {
    void ctx.sendText(GROUP_CONFIG.messages.error);
    return;
  }

  // Check if secret word is not configured
  if (!validation.hasSecretWord) {
    void ctx.sendText(GROUP_CONFIG.messages.error);
    return;
  }

  // Check if user is already in the group
  if (validation.isAlreadyInGroup) {
    void ctx.sendText(GROUP_CONFIG.messages.alreadyInGroup);
    return;
  }

  // Check if the passphrase is valid
  if (validation.isValidPassphrase) {
    void handleSuccessfulPassphrase(ctx);
  } else {
    // Wrong passphrase
    void ctx.sendText(GROUP_CONFIG.messages.invalid);
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();

async function handleSuccessfulPassphrase(ctx: MessageContext) {
  try {
    // Check if we already have a group created
    // For simplicity, we'll create a new group each time
    // In a production app, you'd want to store the group ID
    const group = await ctx.client.conversations.newGroup(
      [ctx.message.senderInboxId],
      {
        groupName: GROUP_CONFIG.groupName,
        groupDescription: GROUP_CONFIG.groupDescription,
      },
    );

    // Add the user to the groupn

    await group.addMembers([ctx.message.senderInboxId]);

    // Send success messages
    await ctx.sendText(GROUP_CONFIG.messages.success[0]);

    // Send welcome message in the group
    await group.send(GROUP_CONFIG.messages.success[1]);
    await group.send(GROUP_CONFIG.messages.success[2]);

    // Mark user as in group
    usersInGroup.add(ctx.message.senderInboxId);

    console.log(
      `✅ User ${ctx.message.senderInboxId} successfully added to group ${group.id}`,
    );

    // Send group details
    await ctx.sendText(
      `Group Details:\n` +
        `- Group ID: ${group.id}\n` +
        `- Group URL: https://xmtp.chat/conversations/${group.id}\n` +
        `- You can now invite others by sharing the group link!`,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding user to group:", errorMessage);
    await ctx.sendText(GROUP_CONFIG.messages.error);
  }
}
