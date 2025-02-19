# Grok agent example

This example uses the [Grok](https://x.ai/api) API for responses and [XMTP](https://xmtp.org) for secure messaging. You can test your agent on [xmtp.chat](https://xmtp.chat) or any other XMTP-compatible client.

## Environment variables

Add the following keys to a `.env` file:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryption
GROK_API_KEY= # the API key for the Grok API
```

You can generate random keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` script will overwrite the existing `.env` file.

## Usage

```tsx
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

  console.log(
    `Agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}?env=${env}`,
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
    const conversation = client.conversations.getConversationById(
      message.conversationId,
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
```

## Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd integrations
cd grok
# install packages
yarn
# generate random keys (optional)
yarn gen:keys
# run the example
yarn dev
```
