<div align="center">

[![GitHub release](https://img.shields.io/github/release/ephemerahq/xmtp-agents.svg)](https://github.com/huggingface/smolagents/releases)
[![MIT License](https://img.shields.io/github/license/ephemerahq/xmtp-agents)](https://github.com/ephemerahq/xmtp-agents/blob/main/LICENSE)

# xmtp-agents

</div>

#### Why XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous or pseudonymous usage with no tracking of sender routes, IPs, or device and message timestamps.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure.
- **Multi-tenant**: Allows multi-agent multi-human confidential communication over MLS group chats.

> See [FAQ](https://docs.xmtp.org/intro/faq) for more detailed information.

## Groups

> [!NOTE]
> You need to add the agent **as a member** to the group.

```tsx
// Create group
const group = await client?.conversations.newGroup([address1, address2]);

// Add member
await group.addMembers([0xaddresses]);

// Change group metadata
await group.name("New name")

// get group members
const members = await group.members();
```

> To learn more about groups, read the [XMTP documentation](https://docs.xmtp.org).

## Web inbox

Interact with the XMTP protocol using [xmtp.chat](https://xmtp.chat) the official web inbox for developers using the latest version powered by MLS.

![](/chat.png)

> [!WARNING]
> This React app isn't a complete solution. For example, the list of conversations doesn't update when new messages arrive in existing conversations.

## Development

```bash
# clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agents/
cd xmtp-agents

# install dependencies
yarn install

# build
yarn build

# gm example
cd gm
yarn dev

# gated grouo
cd gated-group
yarn dev
```
