# Domain resolver example

An XMTP agent that resolves ENS names to Ethereum addresses and performs reverse lookups.

![](./screenshot.png)

## Features

- **Forward Resolution**: Send an ENS name (e.g., `vitalik.eth`) to get the Ethereum address
- **Reverse Resolution**: Send an Ethereum address to find its registered ENS name
- **Real-time Responses**: Get instant domain resolution results

## Usage

Simply message the agent with:

- An ENS name: `vitalik.eth`
- An Ethereum address: `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`

The agent will automatically detect the input type and perform the appropriate lookup.

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
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

### Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/xmtp-domain-resolver
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
