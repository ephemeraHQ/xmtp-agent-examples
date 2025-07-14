import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, Group, type XmtpEnv } from "@xmtp/node-sdk";

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

  // Stream all messages for GM responses
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
        // Skip if the message is from the agent
        if (
          message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()
        ) {
          return;
        }
        // Skip if the message is not a text message
        if (message.contentType?.typeId !== "text") {
          return;
        }

        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (!conversation) {
          console.log("Unable to find conversation, skipping");
          return;
        }

        // Skip if the conversation is a group
        if (conversation instanceof Group) {
          console.log("Conversation is a group, skipping");
          return;
        }
        console.log("Conversation with ", message.senderInboxId);

        //Getting the address from the inbox id
        const inboxState = await client.preferences.inboxStateFromInboxIds([
          message.senderInboxId,
        ]);
        const addressFromInboxId = inboxState[0].identifiers[0].identifier;
        console.log(`Sending "gm" response to ${addressFromInboxId}...`);
        await conversation.send("gm");
      })();
    });
  };

  // Start the message stream
  messageStream();
}

main().catch(console.error);
