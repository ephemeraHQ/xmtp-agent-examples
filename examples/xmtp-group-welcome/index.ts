import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, Group, type GroupMember, type XmtpEnv } from "@xmtp/node-sdk";

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
    const stream = await client.conversations.stream();
    console.log("Waiting for conversations...");
    for await (const conversation of stream) {
      if (conversation instanceof Group) {
        console.log("Conversation found", conversation.id);

        const messages = await conversation.messages();
        const hasSentBefore = messages.some(
          (msg) =>
            msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
        );
        const members = await conversation.members();
        const wasMemberBefore = members.some(
          (member: GroupMember) =>
            member.inboxId.toLowerCase() === client.inboxId.toLowerCase() &&
            member.installationIds.length > 1,
        );
        console.log("hasSentBefore", hasSentBefore);
        console.log("wasMemberBefore", wasMemberBefore);
        if (!hasSentBefore && !wasMemberBefore) {
          await conversation.send("Hey thanks for adding me to the group");
        }
      }
    }
  };

  const messageStream = async () => {
    console.log("Waiting for messages...");
    const stream = await client.conversations.streamAllMessages();
    for await (const message of stream) {
      if (message.contentType?.typeId !== "group_updated") {
        console.log("Skipping message", message.content);
        return;
      }

      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (
        conversation instanceof Group &&
        message.content &&
        typeof message.content === "object" &&
        "addedInboxes" in message.content
      ) {
        for (const addedInbox of message.content.addedInboxes) {
          await conversation.send("Welcome to the group " + addedInbox.inboxId);
        }
      }
    }
  };

  // Run both streams concurrently
  void conversationStream();
  void messageStream();
}

main().catch(console.error);
