# Transaction Content Type example

This example uses 2 content types related to transaction requests and receipts.

https://github.com/user-attachments/assets/efb8006d-9758-483d-ad1b-9287ea4d426d

## Getting started

> [!NOTE]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- This example works on `Base` Sepolia
- You'll need some `ETH` in your wallet to pay for the transaction
- Connect with a wallet extension like [MetaMask](https://metamask.io/) or Coinbase Wallet
- Docker (optional, for `local` network)
- Faucets for [USDC](https://faucet.circle.com)
- [@xmtp/content-type-transaction-reference](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-transaction-reference)
- [@xmtp/content-type-wallet-send-calls](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-wallet-send-calls)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key for the wallet
ENCRYPTION_KEY= # the encryption key for the wallet
# public key is

NETWORK_ID=base-sepolia # base-mainnet or others
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
cd examples/xmtp-transaction-content-type
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

### Commands

```bash
# send a transaction request
/tx <amount>

# check your balance
/balance
```

### Create a transaction request

With XMTP, a transaction request is represented using wallet_sendCalls RPC specification from EIP-5792 with additional metadata for display:

```tsx
const walletSendCalls: WalletSendCallsParams = {
  version: "1.0",
  from: address as `0x${string}`,
  chainId: toHex(84532), // Base Sepolia
  calls: [
    {
      to: "0x789...cba",
      data: "0xdead...beef",
      metadata: {
        description: "Transfer .1 USDC on Base Sepolia",
        transactionType: "transfer",
        currency: "USDC",
        amount: 10000000,
        decimals: 6,
        networkId: "base-sepolia",
      },
    },
  ],
};
```

Once you have a transaction reference, you can send it as part of your conversation:

```tsx
await conversation.messages.send(walletSendCalls, ContentTypeWalletSendCalls);
```

### Supported networks

All eth networks are supported.This example covers Base Sepolia and Base Mainnet.

```tsx
// Configuration constants
const networks = [
  {
    tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    chainId: toHex(84532), // Base Sepolia network ID (84532 in hex)
    decimals: 6,
    networkName: "Base Sepolia",
    networkId: "base-sepolia",
  },
  {
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base Mainnet
    chainId: toHex(8453), // Base Mainnet network ID (8453 in hex)
    decimals: 6,
    networkName: "Base Mainnet",
    networkId: "base-mainnet",
  },
];
```
