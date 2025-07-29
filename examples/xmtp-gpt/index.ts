import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, Group, type XmtpEnv } from "@xmtp/node-sdk";
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
 * Get GPT response for a given message
 */
async function getGPTResponse(message: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: message }],
      model: "gpt-4o-mini",
    });

    return (
      completion.choices[0]?.message?.content ||
      "I'm not sure how to respond to that."
    );
  } catch (error) {
    console.error("Error getting GPT response:", error);
    throw error;
  }
}

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
    const stream = await client.conversations.streamAllMessages({
      onError: (error) => {
        console.error("Error in message stream:", error);
      },
      onValue: async (message) => {
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

        const messageContent = message.content as string;
        console.log(`Received message: ${messageContent}`);

        try {
          const response = await getGPTResponse(messageContent);
          console.log(`Sending GPT response: ${response}`);
          await conversation.send(response);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Error getting GPT response:", errorMessage);
          await conversation.send(
            "Sorry, I encountered an error processing your message.",
          );
        }
      },
    });

    // Keep the stream alive
    for await (const _ of stream) {
      // This loop keeps the stream active
    }
  };

  // Start the message stream
  void messageStream();
}

main().catch(console.error);
