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

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
```

You can generate random keys with the following command:

```bash
yarn gen:keys
```

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

### Conversations can be of type `Group` or `Dm`

The new `Group` and `Dm` classes extend the `Conversation` class and provide specific functionality based on the conversation type.

```tsx
const conversations: (Group | Dm)[] = await client.conversations.list();

for (const conversation of conversations) {
  // narrow the type to Group to access the group name
  if (conversation instanceof Group) {
    console.log(group.name);
  }

  // narrow the type to Dm to access the peer inboxId
  if (conversation instanceof Dm) {
    console.log(conversation.peerInboxId);
  }
}
```

## Web inbox

Interact with the XMTP network using [xmtp.chat](https://xmtp.chat), the official web inbox for developers.

![](/media/chat.png)

## Examples

- [gm](/examples/gm/): A simple agent that replies to all text messages with "gm".
- [gpt](/examples/gpt/): An example using GPT API's to answer messages.
- [gated-group](/examples/gated-group/): Add members to a group that hold a certain NFT.

> See all the available [examples](/examples/).

### Integrations

Examples integrating XMTP with external libraries from the ecosystem

- [grok](/integrations/grok/): Integrate XMTP to the Grok API
- [gaia](/integrations/gaia/): Integrate XMTP to the Gaia API

> See all the available [integrations](/integrations/).
