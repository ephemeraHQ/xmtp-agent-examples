# XMTP agent examples

This repository provides examples of agents that use the [XMTP](https://docs.xmtp.org/) network. These agents are built with the [XMTP Node SDK](https://github.com/xmtp/xmtp-js/tree/main/sdks/node-sdk).

🎥 Watch [Vibe coding secure agents with XMTP](https://youtu.be/djRLnWUvwIA) for a quickstart guide to building with these example agents.

## Why build agents with XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous usage through SDKs and pseudonymous usage with nodes tracking minimum metadata.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure and ensuring continued operation even if some nodes go offline.
- **Multi-agent**: Allows confidential communication between multiple agents and humans through MLS group chats.

## Example agents

- [xmtp-gm](/examples/xmtp-gm/): A simple agent that replies to all text messages with "gm"
- [xmtp-gpt](/examples/xmtp-gpt/): An example using GPT API's to answer messages
- [xmtp-nft-gated-group](/examples/xmtp-nft-gated-group/): Add members to a group based on an NFT
- [xmtp-secret-word-group](/examples/xmtp-secret-word-group/): Add members to a group based on a secret word
- [xmtp-coinbase-agentkit](/examples/xmtp-coinbase-agentkit/): Agent that uses a CDP for gasless USDC on base
- [xmtp-transactions](/examples/xmtp-transactions/): Allow transactions between users and agents
- [xmtp-gaia](/examples/xmtp-gaia/): Agent that uses a CDP for gasless USDC on base
- [xmtp-group-welcome](/examples/xmtp-group-welcome/): Sends a welcome message when its added and to new members
- [xmtp-smart-wallet](/examples/xmtp-smart-wallet/): Agent that uses a smart wallet to send messages
- [xmtp-attachments](/examples/xmtp-attachments/): Agent that sends and receives images
- [xmtp-thinking-reaction](/examples/xmtp-thinking-reaction/): Agent that reacts to messages with a thinking emoji
- [xmtp-queue-dual-client](/examples/xmtp-queue-dual-client/): Agent that uses two clients to send and receive messages
- [xmtp-multiple-workers](/examples/xmtp-multiple-workers/): Agent that uses multiple workers to send and receive messages
- [xmtp-stream-callbacks](/examples/xmtp-stream-callbacks/): Stream callbacks for XMTP agents
- [xmtp-skills](/examples/xmtp-skills/): Helper functions for managing XMTP agents

## Run example agents

### Prerequisites

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (to run a local XMTP network, optional)

### Cursor rules

See these [Cursor rules](/.cursor) for vibe coding agents with XMTP using best practices.

### Set environment variables

To run an example XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

You can generate random XMTP keys by running:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

You can revoke old installations by running:

```bash
# you can get your values from terminal logs
yarn revoke <inbox-id> <installations-to-exclude>
```

### Run an example agent

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

### Optional: Run a local XMTP network

`dev` and `production` networks are hosted by XMTP, while you can run your own `local` network.

1. Install Docker

2. Start the XMTP service and database

   ```bash
   ./dev/up
   ```

3. Change the `.env` file to use the `local` network

   ```bash
   XMTP_ENV = local
   ```

4. Try out the example agents using [xmtp.chat](https://xmtp.chat), the official web inbox for developers.

   ![](/examples/xmtp-gm/screenshot.png)

## Build your own agent

To learn how to build your own production-grade agent with XMTP, see [Tutorial: Build an agent](https://docs.xmtp.org/agents/build-an-agent).
