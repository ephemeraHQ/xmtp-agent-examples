import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

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
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

async function main() {
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
  });

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  logAgentDetails(address, client.inboxId, XMTP_ENV);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const streamPromise = client.conversations.streamAllMessages();

  // Get the actual stream from the promise
  const stream = await streamPromise;

  // Set up error and return handlers on the actual stream
  stream.onError = (error: unknown) => {
    console.error("Stream error:", error);
  };

  stream.onReturn = () => {
    console.log("Stream returned, restarting...");
  };
  try {
    for await (const message of stream) {
      if (
        message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== "text"
      ) {
        continue;
      }

      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("Unable to find conversation, skipping");
        continue;
      }

      const inboxState = await client.preferences.inboxStateFromInboxIds([
        message.senderInboxId,
      ]);
      const addressFromInboxId = inboxState[0].identifiers[0].identifier;
      console.log(`Sending "gm" response to ${addressFromInboxId}...`);
      await conversation.send("gm");

      console.log("Waiting for messages...");
    }
  } catch (error) {
    console.error("Stream error:", error);
  }
}

main().catch(console.error);
