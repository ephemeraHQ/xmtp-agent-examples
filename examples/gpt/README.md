# GPT agent example

This example uses the [OpenAI](https://openai.com) API for GPT-based responses and [XMTP](https://xmtp.org) for secure messaging. You can test your agent on [xmtp.chat](https://xmtp.chat) or any other XMTP-compatible client.

## Environment variables

Add the following keys to a `.env` file:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryption
OPENAI_API_KEY= # the API key for the OpenAI API
```

You can generate random keys with the following command:

```bash
yarn gen:keys
```

## Usage

```tsx
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import OpenAI from "openai";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

const { WALLET_KEY, ENCRYPTION_KEY, OPENAI_API_KEY } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/* Set the environment to local, dev or production */
const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env,
  });

  console.log("Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}?env=${env}`,
  );

  console.log("Waiting for messages...");
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

    const conversation = client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: message.content as string }],
        model: "gpt-3.5-turbo",
      });

      /* Get the AI response */
      const response =
        completion.choices[0]?.message?.content ||
        "I'm not sure how to respond to that.";

      console.log(`Sending AI response: ${response}`);
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
```

## Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
# install packages
yarn
# generate random keys (optional)
yarn gen:keys
# run the example
yarn examples:gpt
```
