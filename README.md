# XMTP agent examples

This repository contains examples of agents that use the [XMTP](https://docs.xmtp.org/) network.

## Why XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous usage through SDKs and pseudonymous usage with nodes tracking minimum metadata.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure and ensuring continued operation even if some nodes go offline.
- **Multi-agent**: Allows confidential communication between multiple agents and humans through MLS group chats.

## Getting started

> [!TIP]
> See the video [here](https://youtu.be/djRLnWUvwIA) for a quickstart guide.
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

You can generate random xmtp keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

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

### Work in local network

`dev` and `production` networks are hosted by XMTP, while `local` network is hosted by yourself.

- 1. Install docker
- 2. Start the XMTP service and database

```bash
./dev/up
```

- 3. Change the .env file to use the local network

```bash
XMTP_ENV = local
```

### Deployment

We have a guide for deploying the agent on [Railway](https://github.com/ephemeraHQ/xmtp-agent-examples/discussions/77).

## Basic usage

### Listening and sending messages

These are the steps to initialize the XMTP listener and send messages.

```tsx
// import the xmtp sdk
import { Client, type XmtpEnv, type Signer } from "@xmtp/node-sdk";

// encryption key, must be consistent across runs
const encryptionKey: Uint8Array = ...;
const signer: Signer = ...;
const env: XmtpEnv = "dev";

// create the client
const client = await Client.create(signer, {encryptionKey, env });
// sync the client to get the latest messages
await client.conversations.sync();

// listen to all messages
const stream = await client.conversations.streamAllMessages();
for await (const message of  stream) {
  // ignore messages from the agent
  if (message?.senderInboxId === client.inboxId ) continue;
  // get the conversation by id
  const conversation = await client.conversations.getConversationById(message.conversationId);
  // send a message from the agent
  await conversation.send("gm");
}
```

### Getting the address of a user

Each user has a unique inboxId for retrieving their associated addresses (identifiers). One inboxId can have multiple identifiers like passkeys or EVM wallet addresses.

> [!NOTE]
> The inboxId differs from the address—it's a user identifier, while the address identifies the user's wallet. Not all users have associated addresses.

```tsx
const inboxState = await client.preferences.inboxStateFromInboxIds([
  message.senderInboxId,
]);
const addressFromInboxId = inboxState[0].identifiers[0].identifier;
```

## Examples

- [xmtp-gm](/examples/xmtp-gm/): A simple agent that replies to all text messages with "gm".
- [xmtp-gpt](/examples/xmtp-gpt/): An example using GPT API's to answer messages.e
- [xmtp-nft-gated-group](/examples/xmtp-nft-gated-group/): Add members to a group based on an NFT
- [xmtp-coinbase-agentkit](/examples/xmtp-coinbase-agentkit/): Agent that uses a CDP for gassless USDC on base
- [xmtp-transactions](/examples/xmtp-transactions/): Use XMTP content types to send transactions
- [xmtp-gaia](/examples/xmtp-gaia/): Agent that uses a CDP for gassless USDC on base
- [xmtp-smart-wallet](/examples/xmtp-smart-wallet/): Agent that uses a smart wallet to send messages
- [xmtp-attachment-content-type](/examples/xmtp-attachment-content-type/): Agent that sends images
- [xmtp-queue-dual-client](/examples/xmtp-queue-dual-client/): Agent that uses two clients to send and receive messages
- [xmtp-multiple-workers](/examples/xmtp-multiple-workers/): Agent that uses multiple workers to send and receive messages
- [xmtp-stream-restart](/examples/xmtp-stream-restart/): Agent that restarts the stream when it fails
- [xmtp-group-welcome](/examples/xmtp-group-welcome/): Agent that sends a welcome message when its added and to new members of a group

These examples are outside of this monorepo and showcase how to use and deploy XMTP in different environments.

- [gm-bot](https://github.com/xmtp/gm-bot): Simple standalone agent that replies to all messages with "gm"
- [xmtp-mini-app-example](https://github.com/ephemeraHQ/xmtp-mini-app): A simple mini app that interacts with a group

## Web inbox

Interact with the XMTP network using [xmtp.chat](https://xmtp.chat), the official web inbox for developers.

![](/examples/xmtp-gm/screenshot.png)
