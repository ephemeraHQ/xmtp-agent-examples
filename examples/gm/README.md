## GM agent

This agent replies `gm`

> Try XMTP using [xmtp.chat](https://xmtp.chat) and sending a message to `gm.xmtp.eth`

![](/media/gm.png)

## Overview

```tsx
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

const { WALLET_KEY, ENCRYPTION_KEY } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/* Set the environment to dev or production */
const env: XmtpEnv = "dev";

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  /* Initialize the xmtp client */
  const client = await Client.create(signer, encryptionKey, { env });

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

    /* Get the conversation by id */
    const conversation = client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    console.log(`Sending "gm" response...`);
    /* Send a message to the conversation */
    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
```
