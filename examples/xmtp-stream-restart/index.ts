import "dotenv/config";
import { Client, type LogLevel, type XmtpEnv } from "@xmtp/node-sdk";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "../../helpers/client";

const { WALLET_KEY, ENCRYPTION_KEY } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
]);

const signer = createSigner(WALLET_KEY as `0x${string}`);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env,
    dbPath: getDbPath(env + "-" + signerIdentifier),
    loggingLevel: process.env.LOGGING_LEVEL as LogLevel,
  });
  void logAgentDetails(client);

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages({
    onError: (error) => {
      console.error("Error in message stream:", error);
    },
    onRetry: (attempts, maxAttempts) => {
      console.log(`Retrying stream... (${attempts}/${maxAttempts})`);
    },
    onRestart: () => {
      console.log("Stream restarted");
    },
    onValue: async (message) => {
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

      console.log(`Sending "gm" response...`);
      await conversation.send("gm");
    },
  });

  // Keep the stream alive
  for await (const _ of stream) {
    // This loop keeps the stream active
  }
}

main().catch(console.error);
