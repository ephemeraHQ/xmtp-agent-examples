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

> [!WARNING]
> Running the `gen:keys` script will overwrite the existing `.env` file.

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

### Working with addresses

Conversations in XMTP can be `DMs` or `Groups`. The underlying technicalities are the same, but DMs are essentially groups locked between two users that can be reused - basically a fixed group of 2. This is how MLS works.

Each member of a conversation has the following properties:

```tsx
inboxId: string; // unique identifier from the XMTP network
accountAddresses: Array<string>; // ethereum network addresses
installationIds: Array<string>; // How many active devices the user has
permissionLevel: PermissionLevel; // In the context of a group, if it's admin or not
consentState: ConsentState; // If it's blocked or allowed via consent
```

To fetch an ethereum address in a DM, you can use a script like the following:

```tsx
const address =
  (await group.members?.find(
    (member: any) => member.inboxId === dm.dmPeerInboxId,
  )?.accountAddresses[0]) || "";
```

> [!WARNING]
> XMTP is working on integrating passkeys as a pillar of identity. Expect a breaking change soon as XMTP prepares for the first v3 stable release.

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
