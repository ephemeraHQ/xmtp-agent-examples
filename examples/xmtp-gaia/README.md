# Gaia agent example

This example uses a [Gaia](https://docs.gaianet.ai) API for AI based responses and [XMTP](https://xmtp.org) for secure messaging. You can test your agent on [xmtp.chat](https://xmtp.chat) or any other XMTP-compatible client.

Using Gaia, you can also run your own [node](https://docs.gaianet.ai/getting-started/quick-start) and use the OpenAI compatible API in this library.

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryption
XMTP_ENV=dev # local, dev, production
GAIA_API_KEY= # Your API key from https://gaianet.ai
GAIA_NODE_URL= # Your custom Gaia node URL or a public node, ex: https://llama8b.gaia.domains/v1
GAIA_MODEL_NAME= # Model name running in your Gaia node or a public node, ex: llama
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
cd examples/xmtp-gaia
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
