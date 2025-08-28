import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, DB_ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "DB_ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const dbEncryptionKey = getEncryptionKeyFromHex(DB_ENCRYPTION_KEY);

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    appVersion: "example-agent/1.0.0",
    loggingLevel: "warn" as LogLevel,
    env: XMTP_ENV as XmtpEnv,
  });
  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();
  for await (const message of stream) {
    // Skip if the message is from the agent
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }
    // Skip if the message is not a text message
    if (message.contentType?.typeId !== "text") {
      continue;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    // // Skip if the conversation is a group
    // if (conversation instanceof Group) {
    //   console.log("Conversation is a group, skipping");
    //   continue;
    // }

    //Getting the address from the inbox id
    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0].identifiers[0].identifier;
    console.log(`Sending "gm" response to ${addressFromInboxId}...`);
    await conversation.send("gm");
  }

  console.log("Message stream started");
}

main().catch(console.error);
