# Domain resolver example

An XMTP agent that resolves Ethereum addresses to Web3 identities using the [Web3.bio API](https://api.web3.bio/).

![](./screenshot.png)

<p align="center">
  <img src="media/left.png" alt="Image 1" width="49%">
  <img src="media/right.png" alt="Image 2" width="49%">
</p>

## Usage

Send mentions with Ethereum addresses or domain names, and the agent will resolve them:

### Core Helpers

```tsx
// Resolve identifier to Ethereum address (agent-sdk)
const address = await resolveAddress("@humanagent.eth");
// Returns: vitalik.eth

// Group member helpers
const members = await ctx.conversation.members();
const addresses = extractMemberAddresses(members);
```

### Supported Platforms

- **ENS** (e.g., `vitalik.eth`)
- **Farcaster** (e.g., `dwr.eth`)
- **Basenames** (e.g., `tony.base.eth`)
- **Lens Protocol** (e.g., `stani.lens`)

### Example Output

```
🔍 Resolved addresses:

✅ @humanagent.eth → 0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204
```

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
