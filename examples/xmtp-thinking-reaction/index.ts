import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import {
  ContentTypeReaction,
  ReactionCodec,
  type Reaction,
} from "@xmtp/content-type-reaction";
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
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Helper function to sleep for a specified number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    appVersion: "example-agent/1.0.0",
    env: XMTP_ENV as XmtpEnv,
    codecs: [new ReactionCodec()],
  });
  void logAgentDetails(client as Client);

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

    try {
      const messageContent = message.content as string;
      console.log(`Received message: ${messageContent}`);

      // Step 1: React with thinking emoji
      console.log("🤔 Reacting with thinking emoji...");
      await conversation.send(
        {
          action: "added",
          content: "⏳",
          reference: message.id,
          schema: "shortcode",
        } as Reaction,
        ContentTypeReaction,
      );

      // Step 2: Sleep for 2 seconds
      console.log("💤 Sleeping for 2 seconds...");
      await sleep(2000);

      // Step 3: Send response
      console.log("💭 Sending response...");
      await conversation.send(
        "I've been thinking about your message and here's my response!",
      );
      await conversation.send(
        {
          action: "removed",
          content: "⏳",
          reference: message.id,
          schema: "shortcode",
        } as Reaction,
        ContentTypeReaction,
      );
      console.log("✅ Response sent successfully");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing message:", errorMessage);
    }
  }

  console.log("Message stream started");
}

main().catch(console.error);
