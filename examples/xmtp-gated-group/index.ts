import { Agent, type AgentContext } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");
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
      "Welcome to our exclusive community!",
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

const agent = await Agent.create();

agent.on("message", (ctx) => {
  const senderInboxId = ctx.message.senderInboxId;
  const conversation = ctx.conversation;
  const messageContent = ctx.message.content as string;
  const secretWord = GROUP_CONFIG.secretWord || "";

  // Check if user is already in the group
  if (!secretWord || usersInGroup.has(senderInboxId)) {
    void ctx.conversation.send(GROUP_CONFIG.messages.alreadyInGroup);
    return;
  }

  // Check if the message is the correct secret word
  if (messageContent.trim().toLowerCase() === secretWord.toLowerCase()) {
    void handleSuccessfulPassphrase(ctx);
  } else {
    // Wrong passphrase
    void conversation.send(GROUP_CONFIG.messages.invalid);
  }
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online: ${url}`);
});

agent.start();

async function handleSuccessfulPassphrase(ctx: AgentContext) {
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
    await ctx.conversation.send(GROUP_CONFIG.messages.success[0]);

    // Send welcome message in the group
    await group.send(GROUP_CONFIG.messages.success[1]);
    await group.send(GROUP_CONFIG.messages.success[2]);

    // Mark user as in group
    usersInGroup.add(ctx.message.senderInboxId);

    console.log(
      `✅ User ${ctx.message.senderInboxId} successfully added to group ${group.id}`,
    );

    // Send group details
    await ctx.conversation.send(
      `Group Details:\n` +
        `- Group ID: ${group.id}\n` +
        `- Group URL: https://xmtp.chat/conversations/${group.id}\n` +
        `- You can now invite others by sharing the group link!`,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding user to group:", errorMessage);
    await ctx.conversation.send(GROUP_CONFIG.messages.error);
  }
}
