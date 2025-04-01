# XMTP agent examples

This repository contains examples of agents that use the [XMTP](https://docs.xmtp.org/) network.

## Why XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous or pseudonymous usage with no tracking of sender routes, IPs, or device and message timestamps.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure.
- **Multi-agent**: Allows multi-agent multi-human confidential communication over MLS group chats.

## Getting started

> [!NOTE]
> See our [Cursor Rules](/.cursor/README.md) for XMTP Agent development standards and best practices.

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```tsx
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV= # local, dev, production
```

You can generate random xmtp keys with the following command:

```tsx
yarn gen:keys <name>
```

> [!WARNING]
> Running the `gen:keys` or `gen:keys <name>` command will append keys to your existing `.env` file.

### Basic usage

These are the steps to initialize the XMTP listener and send messages.

```tsx
// import the xmtp sdk
import { Client, type XmtpEnv, type Signer } from "@xmtp/node-sdk";
// encryption key, must be consistent across runs
const encryptionKey: Uint8Array = ...;
const signer: Signer = ...;
const env: XmtpEnv = "dev";

async function main() {
  const client = await Client.create(signer, encryptionKey, { env });
  await client.conversations.sync();
  const stream = client.conversations.streamAllMessages();
  for await (const message of await stream) {
    // ignore messages from the agent
   if (message?.senderInboxId === client.inboxId ) {
      continue;
    }
    const conversation = client.conversations.getConversationById(message.conversationId);
    // send a message from the agent
    await conversation.send("gm");
  }
}
main().catch(console.error);
```

## Examples

- [gm](/examples/xmtp-gm/): A simple agent that replies to all text messages with "gm".
- [gpt](/examples/xmtp-gpt/): An example using GPT API's to answer messages.e
- [nft-gated-group](/examples/xmtp-nft-gated-group/): Agent that uses a CDP for gassless USDC on base
- [agentkit](/examples/xmtp-agentkit/): Agent that uses a CDP for gassless USDC on base

See all the examples [here](/examples).

## Development

As a starter you can run the `gm` example by following these steps:

### Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

### Web inbox

Interact with the XMTP network using [xmtp.chat](https://xmtp.chat), the official web inbox for developers.

![](/media/chat.png)

### Work in local network

`Dev` and `production` networks are hosted by XMTP, while `local` network is hosted by yourself, so it's faster for development purposes.

- 1. Install docker
- 2. Start the XMTP service and database

```bash
./dev/up
```

- 3. Change the .env file to use the local network

```bash
XMTP_ENV = local
```
