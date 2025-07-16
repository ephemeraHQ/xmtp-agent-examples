import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import {
  Client,
  Group,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";

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

  const onMessage = async (err: Error | null, message?: DecodedMessage) => {
    if (err) {
      console.log("Error", err);
      return;
    }

    if (!message) {
      console.log("No message received");
      return;
    }

    if (
      message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message.contentType?.typeId !== "text"
    ) {
      return;
    }

    console.log(
      `Received message: ${message.content as string} by ${
        message.senderInboxId
      }`,
    );

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

    console.log(`Sending "gm" response...`);
    await conversation.send("gm");
  };

  const handleStream = async (client: Client) => {
    console.log("Syncing conversations...");
    await client.conversations.sync();

    await client.conversations.streamAllMessages(void onMessage);

    console.log("Waiting for messages...");
  };

  await handleStream(client);
}

main().catch(console.error);
