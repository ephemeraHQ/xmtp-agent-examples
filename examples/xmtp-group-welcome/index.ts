import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, Dm, type XmtpEnv } from "@xmtp/node-sdk";

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

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });
  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Starting streams...");

  // Stream conversations for welcome messages
  const conversationStream = async () => {
    console.log("Waiting for new conversations...");
    const stream = client.conversations.stream();

    for await (const conversation of stream) {
      try {
        if (!conversation) {
          console.log("Unable to find conversation, skipping");
          continue;
        }
        const fetchedConversation =
          await client.conversations.getConversationById(conversation.id);

        if (!fetchedConversation) {
          console.log("Unable to find conversation, skipping");
          continue;
        }
        const isDm = fetchedConversation instanceof Dm;
        if (isDm) {
          console.log("Skipping DM conversation, skipping");
          continue;
        }
        console.log("Conversation found", fetchedConversation.id);

        const messages = await fetchedConversation.messages();
        const hasSentBefore = messages.some(
          (msg) =>
            msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
        );

        if (!hasSentBefore) {
          await fetchedConversation.send(
            "Hey thanks for adding me to the group",
          );
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  // Stream all messages for logging
  const messageStream = async () => {
    console.log("Waiting for messages...");
    const stream = await client.conversations.streamAllMessages();

    for await (const message of stream) {
      if (
        !message ||
        message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()
      )
        continue;

      if (message.contentType?.typeId === "text") {
        console.log(message.content);
        continue;
      }
      if (message.contentType?.typeId !== "group_updated") {
        continue;
      }

      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );
      if (conversation) {
        if (
          message.content &&
          typeof message.content === "object" &&
          "addedInboxes" in message.content
        ) {
          for (const addedInbox of message.content.addedInboxes) {
            await conversation.send(
              "Welcome to the group " + addedInbox.inboxId,
            );
          }
        }
      }
    }
  };

  // Run both streams concurrently
  await Promise.all([conversationStream(), messageStream()]);
}

main().catch(console.error);
