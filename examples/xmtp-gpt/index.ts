import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import OpenAI from "openai";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, OPENAI_API_KEY, XMTP_ENV } =
  validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "OPENAI_API_KEY",
    "XMTP_ENV",
  ]);

/* Initialize the OpenAI client */
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Main function to run the agent
 */
async function main() {
  /* Create the signer using viem and parse the encryption key for the local db */
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  void logAgentDetails(client);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  // Stream all messages for GPT responses
  const messageStream = async () => {
    console.log("Waiting for messages...");
    const stream = client.conversations.streamAllMessages();
    for await (const message of await stream) {
      /* Ignore messages from the same agent or non-text messages */
      if (
        message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message.contentType?.typeId !== "text"
      ) {
        return;
      }

      console.log(
        `Received message: ${message.content as string} by ${message.senderInboxId}`,
      );

      /* Get the conversation from the local db */
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      /* If the conversation is not found, skip the message */
      if (!conversation) {
        console.log("Unable to find conversation, skipping");
        return;
      }

      try {
        /* Get the AI response */
        const completion = await openai.chat.completions.create({
          messages: [{ role: "user", content: message.content as string }],
          model: "gpt-4.1-mini",
        });

        /* Get the AI response */
        const response =
          completion.choices[0]?.message?.content ||
          "I'm not sure how to respond to that.";

        console.log(`Sending AI response: ${response}`);
        /* Send the AI response to the conversation */
        await conversation.send(response);
      } catch (error) {
        console.error("Error getting AI response:", error);
        await conversation.send(
          "Sorry, I encountered an error processing your message.",
        );
      }
    }
  };

  // Start the message stream
  void messageStream();
}

main().catch(console.error);
