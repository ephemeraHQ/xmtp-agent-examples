# Domain resolver example

An XMTP agent that performs reverse resolution of Ethereum addresses to Web3 identities using the [Web3.bio API](https://api.web3.bio/) and Farcaster FID lookups.

![](./screenshot.png)

<p align="center">
  <img src="media/left.png" alt="Image 1" width="49%">
  <img src="media/right.png" alt="Image 2" width="49%">
</p>

## Usage

Send an Ethereum address and the agent will look up associated domain names and Farcaster IDs across various Web3 platforms:

```tsx
on("text", async (ctx) => {
  const input = ctx.getSenderAddress();
  const results = await fetchFromWeb3Bio(input);
  const names = results.map((result) => result.identity).join("\n");
  await ctx.sendText(names);
});
```

- **ENS** (e.g., `vitalik.eth`)
- **Farcaster** (e.g., `dwr.eth`) with FID lookup
- **Lens Protocol** (e.g., `stani.lens`)
- **Basenames** (e.g., `tony.base.eth`)
- **Linea Name Service** (e.g., `name.linea.eth`)

### Farcaster FID Lookup

The resolver now includes Farcaster FID (Farcaster ID) lookup capabilities:

```tsx
// Get FID by username
const fid = await getFarcasterFID("vitalik");
// Returns: 5650 (the FID number)

// Get FID by Ethereum address
const result = await getFarcasterFIDByAddress("vitalik.eth");
// Returns: { username: "vitalik.eth", fid: 5650 }
```

Example output:

```
🔍 Resolved addresses:

✅ @vitalik.eth → 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
   Farcaster: vitalik.eth (FID: 5650)

✅ @bankr → 0x12e83ba524041062d5dc702a6ea4f97e3ddcff29
   Farcaster: bankr (FID: 291955)
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
