<div align="center">

[![GitHub release](https://img.shields.io/github/release/ephemerahq/xmtp-agents.svg)](https://github.com/huggingface/smolagents/releases)
[![MIT License](https://img.shields.io/github/license/ephemerahq/xmtp-agents)](https://github.com/ephemerahq/xmtp-agents/blob/main/LICENSE)

<img src="media/logo.png" alt="Logo" width="60" />

# xmtp-agents

</div>

#### Why XMTP?

- **End-to-end & compliant**: Data is encrypted in transit and at rest, meeting strict security and regulatory standards.
- **Open-source & trustless**: Built on top of the [MLS](https://messaginglayersecurity.rocks/) protocol, it replaces trust in centralized certificate authorities with cryptographic proofs.
- **Privacy & metadata protection**: Offers anonymous or pseudonymous usage with no tracking of sender routes, IPs, or device and message timestamps.
- **Decentralized**: Operates on a peer-to-peer network, eliminating single points of failure.
- **Multi-tenant**: Allows multi-agent multi-human confidential communication over MLS group chats.

> See [FAQ](https://docs.xmtp.org/intro/faq) for more detailed information.

## Examples

Various examples and tutorials to help you get started with creating and deploying your own agents using XMTP.

- [gated-group](/examples/gated-group/): Create a gated group chat that verifies NFT ownership using Alchemy.
- [gm](/examples/gm/): A simple agent that replies with `gm`.

## Encryption keys

- `WALLET_KEY`: XMTP encryption keys can be managed in several ways. Here are the most common methods:

  1. Use an environment variable to provide the private key:

     - Store your private key in a `.env` file:
       `WALLET_KEY=0xYOUR_PRIVATE_KEY`

     ```tsx
     const agent = await createClient({
       walletKey: process.env.WALLET_KEY,
     });
     ```

2. Generate the private key at runtime:

   - If no private key is provided, the agent can automatically generate a new one upon startup:
     `WALLET_KEY=random_key`
   - If exists in the .env file it will **not** generated a new key.
   - This method will save the key in the `.env` file for future use.

     ```tsx
     const agent = await createClient();
     ```

3. Assign a name (alias) to the randomly generated key:

   - Providing a "name" gives your key a meaningful identifier, aiding in organization and persistence.
     `WALLET_KEY_agentA=0xYOUR_PRIVATE_KEY`
   - This method will also save the key in the `.env` file for future use.

     ```tsx
     const agent = await createClient({
       name: "agentA", // Optional suffix for this agent's key
     });
     ```

- `ENCRYPTION_KEY`: The fixed key is an additional security measure. It is not linked to the public address and can be randomly generated or shared across different agents. It will also be generated and saved in the `.env` file using the methods described above.

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

## Deployment

Learn how to deploy with:

- [Railway](/tutorials/railway/)
- [Replit](/tutorials/replit/)

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
