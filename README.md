# XMTP agent examples

This repository contains examples of agents that use the [XMTP](https://docs.xmtp.org/) network.

#### Why XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous or pseudonymous usage with no tracking of sender routes, IPs, or device and message timestamps.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure.
- **Multi-agent**: Allows multi-agent multi-human confidential communication over MLS group chats.

> See [FAQ](https://docs.xmtp.org/intro/faq) for more detailed information.

## Getting started

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```tsx
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV= # local, dev, production
```

You can generate random xmtp keys with the following command:

```tsx
yarn gen:keys <name>
```

> [!WARNING]
> Running the `gen:keys` or `gen:keys <name>` command will append keys to your existing `.env` file.

### Work in local network

`Dev` and `production` networks are hosted by XMTP, while `local` network is hosted by yourself. Use local network for development purposes only.

- 1. Install docker
- 2. Start the XMTP service and database

```tsx
./dev/up
```

- 3. Change the .env file to use the local network

```tsx
XMTP_ENV = local;
```

## Concepts

> [!NOTE]
> For detailed XMTP Agent development guidelines, please refer to our [Cursor Rules documentation](/.cursor/README.md) which contains comprehensive coding standards and best practices for XMTP integration.

### Fetching messages

There are to ways to fetch messages from a conversation, one is by starting a stream

```tsx
const stream = client.conversations.streamAllMessages();
for await (const message of await stream) {
  /*You message*/
}
```

And by polling you can call all the messages at once, which we stored in your local database

```tsx
/* Sync the conversations from the network to update the local db */
await client.conversations.sync();
// get message array
await client.conversations.messages();
```

### Working with addresses

Because XMTP is interoperable, you may interact with inboxes that are not on your app. In these scenarios, you will need to find the appropriate inbox ID or address.

```tsx
// get an inbox ID from an address
const inboxId = await getInboxIdForIdentifier({
  identifier: "0x1234567890abcdef1234567890abcdef12345678",
  identifierKind: IdentifierKind.Ethereum,
});

// find the addresses associated with an inbox ID
const inboxState = await client.inboxStateFromInboxIds([inboxId]);

interface InboxState {
  inboxId: string;
  recoveryIdentifier: Identifier;
  installations: Installation[];
  identifiers: Identifier[];
}

const addresses = inboxState.identifiers
  .filter((i) => i.identifierKind === IdentifierKind.Ethereum)
  .map((i) => i.identifier);
```

## Web inbox

Interact with the XMTP network using [xmtp.chat](https://xmtp.chat), the official web inbox for developers.

![](/media/chat.png)

## Examples

- [gm](/gm/): A simple agent that replies to all text messages with "gm".
- [gpt](/examples/gpt/): An example using GPT API's to answer messages.
- [gated-group](/examples/gated-group/): Add members to a group that hold a certain NFT.
- [grok](/examples/grok/): Integrate your agent with the Grok API
- [gaia](/examples/gaia/): Integrate with the Gaia API
- [coinbase-langchain](/examples/coinbase-langchain/): Agent that uses a CDP for gassless USDC on base

> See our contribution guidelines [here](/CONTRIBUTING.md).
