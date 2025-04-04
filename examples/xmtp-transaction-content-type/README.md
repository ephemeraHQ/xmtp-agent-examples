# Transaction agent example

This example uses 2 content types related to transaction requests and receipts.

https://github.com/user-attachments/assets/efb8006d-9758-483d-ad1b-9287ea4d426d

## Getting started

> [!NOTE]
> See our [Cursor Rules](/.cursor/README.md) for XMTP Agent development standards and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Connect with a wallet extension like [MetaMask](https://metamask.io/) or Coinbase Wallet
- Docker (optional, for `local` network)
- [USDC Faucet](https://portal.cdp.coinbase.com/products/faucet)
- [@xmtp/content-type-transaction-reference](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-transaction-reference)
- [@xmtp/content-type-wallet-send-calls](https://github.com/xmtp/xmtp-js/tree/main/content-types/content-type-wallet-send-calls)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key for the wallet
ENCRYPTION_KEY= # the encryption key for the wallet
# public key is

NETWORK_ID=base-sepolia # base-mainnet or others
OPENAI_API_KEY= # the OpenAI API key
CDP_API_KEY_NAME= # the name of the CDP API key
CDP_API_KEY_PRIVATE_KEY= # the private key for the CDP API key
XMTP_ENV=local # local, dev, production
```

You can generate random xmtp keys with the following command:

```tsx
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
cd examples/transaction
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

### Create a transaction request

With XMTP, a transaction request is represented using wallet_sendCalls RPC specification from EIP-5792 with additional metadata for display:

```tsx
const walletSendCalls: WalletSendCallsParams = {
  version: "1.0",
  from: address as `0x${string}`,
  chainId: "0x2105",
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
        platform: "base-sepolia",
      },
    },
  ],
};
```

### Send a transaction request

Once you have a transaction reference, you can send it as part of your conversation:

```tsx
await conversation.messages.send(walletSendCalls, ContentTypeWalletSendCalls);
```

### Receive a transaction receipt

```tsx
const receipt = await conversation.messages.receive();
```
