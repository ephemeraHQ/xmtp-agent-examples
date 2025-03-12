import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, GROK_API_KEY } = process.env;

/* Check if the environment variables are set */
if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

/* Check if the encryption key is set */
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

/* Check if the Grok API key is set */
if (!GROK_API_KEY) {
  throw new Error("GROK_API_KEY must be set");
}

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

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
      /* Get the AI response from Grok */
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROK_API_KEY}`, // Use the same API key variable
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "You are a test assistant." },
            { role: "user", content: message.content as string },
          ],
          model: "grok-2-latest",
          stream: false,
          temperature: 0,
        }),
      }).then(
        (res) =>
          res.json() as Promise<{
            choices: { message: { content: string } }[];
          }>,
      );
      const aiResponse = response.choices[0]?.message?.content || "";
      console.log(`Sending AI response: ${aiResponse}`);
      /* Send the AI response to the conversation */
      await conversation.send(aiResponse);
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
