import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import OpenAI from "openai";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const {
  WALLET_KEY,
  ENCRYPTION_KEY,
  GAIA_NODE_URL,
  GAIA_API_KEY,
  GAIA_MODEL_NAME,
} = process.env;

/* Check if the environment variables are set */
if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

/* Check if the encryption key is set */
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

/* Check if the OpenAI API key is set */
if (!GAIA_API_KEY) {
  throw new Error("GAIA_API_KEY must be set");
}

/* Check if the Gaia node's base URL is set */
if (!GAIA_NODE_URL) {
  throw new Error("GAIA_NODE_URL must be set");
}

/* Check if the the model name for the Gaia node is set */
if (!GAIA_MODEL_NAME) {
  throw new Error("GAIA_MODEL_NAME must be set");
}

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/* Initialize the OpenAI client */
const openai = new OpenAI({
  baseURL: GAIA_NODE_URL,
  apiKey: GAIA_API_KEY,
});

/* Set the environment to dev or production */
const env: XmtpEnv = "dev";

/**
 * Main function to run the agent
 */
async function main() {
  console.log(`Creating client on the '${env}' network...`);
  /* Initialize the xmtp client */
  const client = await Client.create(signer, encryptionKey, {
    env,
  });

  console.log("Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}`,
  );

  console.log("Waiting for messages...");
  /* Stream all messages from the network */
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    /* Get the conversation from the local db */
    const conversation = client.conversations.getDmByInboxId(
      message.senderInboxId,
    );

    /* If the conversation is not found, skip the message */
    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    try {
      /* Get the AI response */
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: message.content as string }],
        model: GAIA_MODEL_NAME as string,
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

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
