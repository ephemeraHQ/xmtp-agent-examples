import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, Dm, type Group, type XmtpEnv } from "@xmtp/node-sdk";

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
  const conversationStream = () => {
    console.log("Waiting for new conversations...");
    const handleConversation = (
      error: Error | null,
      conversation: Group | Dm | undefined,
    ) => {
      if (error) {
        console.error("Error in conversation stream:", error);
        return;
      }
      if (!conversation) {
        console.log("No conversation received");
        return;
      }

      void (async () => {
        try {
          const fetchedConversation =
            await client.conversations.getConversationById(conversation.id);

          if (!fetchedConversation) {
            console.log("Unable to find conversation, skipping");
            return;
          }
          const isDm = fetchedConversation instanceof Dm;
          if (isDm) {
            console.log("Skipping DM conversation, skipping");
            return;
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
      })();
    };
    // @ts-expect-error - TODO: fix this
    void client.conversations.stream(handleConversation);
  };

  // Stream all messages for logging
  const messageStream = () => {
    console.log("Waiting for messages...");
    void client.conversations.streamAllMessages((error, message) => {
      if (error) {
        console.error("Error in message stream:", error);
        return;
      }
      if (!message) {
        console.log("No message received");
        return;
      }

      void (async () => {
        if (message.contentType?.typeId === "text") {
          console.log(message.content);
          return;
        }
        if (message.contentType?.typeId !== "group_updated") {
          return;
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
      })();
    });
  };

  // Run both streams concurrently
  conversationStream();
  messageStream();
}

main().catch(console.error);
