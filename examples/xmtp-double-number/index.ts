import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);
// Validate environment variables
if (!WALLET_KEY) {
  throw new Error("WALLET_KEY environment variable is required");
}
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}
if (!XMTP_ENV) {
  throw new Error("XMTP_ENV environment variable is required");
}

async function main() {
  // Initialize client
  const signer = createSigner(WALLET_KEY as `0x${string}`);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("🤖 Double Number Agent is running...");
  console.log("Send me any number and I'll return its 2x multiple!");

  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    // Ignore messages from the same agent or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    try {
      const messageContent = message.content as string;
      console.log(`📨 Received message: ${messageContent}`);

      // Parse the message content as a number
      const number = parseFloat(messageContent.trim());

      // Check if it's a valid number
      if (isNaN(number)) {
        const response =
          "❌ That's not a valid number! Please send me a number and I'll double it for you.";
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (conversation) {
          await conversation.send(response);
        }
        continue;
      }

      // Calculate the doubled value
      const doubled = number * 2;
      const response = `✅ ${number} × 2 = ${doubled}`;

      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (conversation) {
        await conversation.send(response);
      }
      console.log(`📤 Sent response: ${response}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Error processing message:", errorMessage);

      // Try to send an error response
      try {
        await sendResponse(
          message,
          "Sorry, I encountered an error processing your number. Please try again.",
        );
      } catch (sendError) {
        console.error(
          "Failed to send error message:",
          sendError instanceof Error ? sendError.message : String(sendError),
        );
      }
    }
  }
}

main().catch(console.error);
