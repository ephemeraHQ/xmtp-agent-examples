# Domain resolver example

An XMTP agent that performs reverse resolution of Ethereum addresses to Web3 identities using the [Web3.bio API](https://api.web3.bio/).

![](./screenshot.png)

<p align="center">
  <img src="media/left.png" alt="Image 1" width="49%">
  <img src="media/right.png" alt="Image 2" width="49%">
</p>

## Usage

Send an Ethereum address and the agent will look up associated domain names across various Web3 platforms:

```tsx
on("text", async (ctx) => {
  const input = ctx.getSenderAddress();
  const results = await fetchFromWeb3Bio(input);
  const names = results.map((result) => result.identity).join("\n");
  await ctx.sendText(names);
});
```

- **ENS** (e.g., `vitalik.eth`)
- **Farcaster** (e.g., `dwr.eth`)
- **Lens Protocol** (e.g., `stani.lens`)
- **Basenames** (e.g., `tony.base.eth`)
- **Linea Name Service** (e.g., `name.linea.eth`)

Example:

```json
Resolved mentions in message: {
  "0xadc5…f002": "0xadc58094c42e2a8149d90f626a1d6cfb4a79f002",
  "bankr": "0x12e83ba524041062d5dc702a6ea4f97e3ddcff29",
  "humanagent.eth": "0x93e2fc3e99dfb1238eb9e0ef2580efc5809c7204"
}
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
