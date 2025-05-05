# CDP Smart Contract Wallet

This example demonstrates an agent setup on XMTP Network with access to the full set of CDP Smart Contract Wallets.

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials
- Faucets for [USDC](https://faucet.circle.com)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key for the wallet
ENCRYPTION_KEY= # the encryption key for the wallet
# public key is

NETWORK_ID=base-sepolia # base-mainnet or others
CDP_API_KEY_NAME= # the name of the CDP API key
CDP_API_KEY_PRIVATE_KEY= # the private key for the CDP API key
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
cd examples/xmtp-smart-wallet
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

Use coinbase sdk to create a smart contract wallet.

```tsx
Coinbase.configure({
  apiKeyName: CDP_API_KEY_NAME,
  privateKey: CDP_API_KEY_PRIVATE_KEY,
});
const wallet = await Wallet.create({
  networkId: NETWORK_ID,
});

console.log("Wallet created successfully, exporting data...");
const data = wallet.export();
console.log("Getting default address...");
const walletInfo: WalletData = {
  seed: data.seed || "",
  walletId: wallet.getId() || "",
  networkId: wallet.getNetworkId(),
};
```
