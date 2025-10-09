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
const address = await resolveAddress("vitalik.eth");
// Returns: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

// Resolve address to Web3 name (web3.bio, first result)
const name = await resolveName("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
// Returns: vitalik.eth

// Group member helpers
const members = await ctx.conversation.members();
const addresses = extractMemberAddresses(members);
```

### Supported Platforms

- **ENS** (e.g., `vitalik.eth`)
- **Farcaster** (e.g., `dwr.eth`)
- **Lens Protocol** (e.g., `stani.lens`)
- **Basenames** (e.g., `tony.base.eth`)
- **Linea Name Service** (e.g., `name.linea.eth`)

### Example Output

```
🔍 Resolved addresses:

✅ @vitalik.eth → 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
   Name: vitalik.eth

✅ @bankr → 0x12e83ba524041062d5dc702a6ea4f97e3ddcff29
   Name: bankr
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
