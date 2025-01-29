<div align="center">

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

## Keys

By default, your bot will have a new address every time you start it up. That's ideal. If you have a private key, you can encode it to a hex string and set the KEY environment variable. Your bot will then use this key to connect to the network.

XMTP uses two types of keys:

1. **Wallet Key**:

   - An Ethereum private key (e.g. `0x123...`) that defines your bot’s **on-chain identity** (its public address) (e.g. `hi.xmtp.eth`).
   - By providing this key, messages sent from your bot will be tied to a consistent address.

2. **Encryption Key**:
   - Protects your **local database** of stored messages (it does not affect on-chain identity).
   - If not provided, it’s created automatically and saved to your `.env`.

### 1. Provide a private key

If you already have a key, place it in `.env`:

```bash
WALLET_KEY=0xYOUR_PRIVATE_KEY
```

**Usage**:

```ts
const agent = await createClient({
  walletKey: process.env.WALLET_KEY,
});
```

The bot reuses this key, retaining the same address each time it starts.

---

### 2. Automatically generate a key

If you don’t set `WALLET_KEY`, the bot creates a new one at runtime:

```ts
const agent = await createClient();
```

**Workflow**:

1. A fresh Ethereum private key is generated.
2. Key details are saved to your `.env` so the bot reuses them in future runs.

---

### 3. Use a named key

When running multiple bots, each can have a distinct name to avoid overwriting each other’s keys:

```ts
const agent = await createClient({ name: "botA" });
```

In `.env`, this will be stored as `WALLET_KEY_botA=...`  
**Benefit**: Simplifies managing multiple identities from one project.

## Web inbox

Interact with the XMTP protocol using [xmtp.chat](https://xmtp.chat) the official web inbox for developers using the latest version powered by MLS.

![](/chat.png)

> To learn more about dev tool visit the [official repo](https://github.com/xmtp/xmtp-js/tree/main/apps/xmtp.chat)

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
yarn gm
# or
cd examples
cd gm
yarn dev

# gated group example
yarn gated
# or
cd examples
cd gated-group
yarn dev
```
