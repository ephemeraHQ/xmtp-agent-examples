import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type Group, type XmtpEnv } from "@xmtp/node-sdk";

// Validate required environment variables
const { WALLET_KEY, DB_ENCRYPTION_KEY, XMTP_ENV, SECRET_WORD } =
  validateEnvironment([
    "WALLET_KEY",
    "DB_ENCRYPTION_KEY",
    "XMTP_ENV",
    "SECRET_WORD",
  ]);

// Configuration for the secret word gated group
const GROUP_CONFIG = {
  // The secret passphrase users must provide to join
  secretWord: SECRET_WORD,
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

async function main() {
  // Initialize XMTP client
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(DB_ENCRYPTION_KEY);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    appVersion: "example-agent/1.0.0",
    env: XMTP_ENV as XmtpEnv,
  });

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  void logAgentDetails(client);

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    // Ignore messages from the same agent or non-text messages
    if (
      message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message.contentType?.typeId !== "text"
    ) {
      continue;
    }

    const messageContent = message.content as string;
    const senderInboxId = message.senderInboxId;

    console.log(`Received message: "${messageContent}" from ${senderInboxId}`);

    try {
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("Could not find conversation for message");
        continue;
      }

      // Check if user is already in the group
      if (usersInGroup.has(senderInboxId)) {
        await conversation.send(GROUP_CONFIG.messages.alreadyInGroup);
        continue;
      }

      // Check if the message is the correct secret word
      if (
        messageContent.trim().toLowerCase() ===
        GROUP_CONFIG.secretWord.toLowerCase()
      ) {
        await handleSuccessfulPassphrase(
          client,
          conversation as Group,
          senderInboxId,
        );
      } else {
        // Wrong passphrase
        await conversation.send(GROUP_CONFIG.messages.invalid);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing message:", errorMessage);

      // Try to send error message
      try {
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );
        if (conversation) {
          await conversation.send(GROUP_CONFIG.messages.error);
        }
      } catch (sendError) {
        console.error("Failed to send error message:", sendError);
      }
    }
  }
}

async function handleSuccessfulPassphrase(
  client: Client,
  conversation: Group,
  senderInboxId: string,
) {
  try {
    // Check if we already have a group created
    // For simplicity, we'll create a new group each time
    // In a production app, you'd want to store the group ID
    const group = (await client.conversations.newGroup([senderInboxId], {
      groupName: GROUP_CONFIG.groupName,
      groupDescription: GROUP_CONFIG.groupDescription,
    })) as Group;

    // Add the user to the groupn

    await group.addMembers([senderInboxId]);

    // Send success messages
    await conversation.send(GROUP_CONFIG.messages.success[0]);

    // Send welcome message in the group
    await group.send(GROUP_CONFIG.messages.success[1]);
    await group.send(GROUP_CONFIG.messages.success[2]);

    // Mark user as in group
    usersInGroup.add(senderInboxId);

    console.log(
      `✅ User ${senderInboxId} successfully added to group ${group.id}`,
    );

    // Send group details
    await conversation.send(
      `Group Details:\n` +
        `- Group ID: ${group.id}\n` +
        `- Group URL: https://xmtp.chat/conversations/${group.id}\n` +
        `- You can now invite others by sharing the group link!`,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error adding user to group:", errorMessage);
    await conversation.send(GROUP_CONFIG.messages.error);
  }
}

main().catch(console.error);
