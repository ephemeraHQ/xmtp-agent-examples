# Domain resolver example

An XMTP agent that resolves Ethereum addresses to Web3 identities using the [Web3.bio API](https://api.web3.bio/).

<p align="center" >
  <img src="media/left.png" alt="Image 1" width="49%">
  <img src="media/right.png" alt="Image 2" width="49%">
</p>

## Usage

Send mentions with Ethereum addresses or domain names, and the agent will resolve them:

```tsx
// Extract mentions from message text
const mentions = extractMentions(ctx.message.content);
// Returns: ["bankr", "0xabc5…f002", "@humanagent.eth"]

// Extract member addresses from group
const members = await ctx.conversation.members();
const addresses = extractMemberAddresses(members);
// Returns: ["0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204", ...]

// Resolve all mentions to Ethereum addresses
const resolved = await resolveMentionsInMessage(
  ctx.message.content,
  memberAddresses,
);
// Returns: { "bankr.farcaster.eth": "0x...", "0xabc5…f002": "0x..." }

// Resolve ENS names or other web3 identities using web3.bio
const resolveAddress = createNameResolver("your-web3bio-api-key");
const address = await resolveAddress("bankr");
console.log(`Resolved address: ${address}`);
```

Example output:

```
🔍 Resolved addresses:

✅ @humanagent.eth → 0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204
```

### Supported platforms

- **ENS** (e.g., `vitalik.eth`)
- **Farcaster** (e.g., `dwr.eth`)
- **Basenames** (e.g., `tony.base.eth`)
- **Lens Protocol** (e.g., `stani.lens`)

## Getting started

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

> [!TIP]
> Base associates their addresses with FIDs. You can see that info in neynar API [https://docs.neynar.com/reference/fetch-bulk-users]
