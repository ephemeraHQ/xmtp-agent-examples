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
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV, LOGGING_LEVEL } =
  validateEnvironment([
    "WALLET_KEY",
    "LOGGING_LEVEL",
    "ENCRYPTION_KEY",
    "XMTP_ENV",
  ]);

const MAX_RETRIES = 6; // 6 times
const RETRY_DELAY_MS = 10000; // 10 seconds

// Helper function to pause execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  /* Create the signer using viem and parse the encryption key for the local db */
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    //This will provide more logs for XMTP to help debug, but can be noisy
    loggingLevel: LOGGING_LEVEL as LogLevel,
  });

  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  // Start stream with limited retries
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(
        `Starting message stream... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
      );
      const streamPromise = client.conversations.streamAllMessages();
      const stream = await streamPromise;

      console.log("Waiting for messages...");
      for await (const message of stream) {
        if (
          message?.senderInboxId.toLowerCase() ===
            client.inboxId.toLowerCase() ||
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

        console.log("Waiting for more messages...");
      }

      // If we get here without an error, reset the retry count
      retryCount = 0;
    } catch (error) {
      retryCount++;
      console.debug(error);
      if (retryCount < MAX_RETRIES) {
        console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        console.log("Maximum retry attempts reached. Exiting.");
      }
    }
  }

  console.log("Stream processing ended after maximum retries.");
}

main().catch(console.error);
