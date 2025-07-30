# XMTP Secret Word Gated Group

An XMTP agent that creates a group that requires a secret passphrase to join.

## How it works

1. Users send a message to the agent
2. The agent checks if the message matches the secret passphrase
3. If correct, the user is added to an exclusive group
4. If incorrect, the user gets an error message

## Setup

1. Generate keys:

```bash
yarn gen:keys
```

2. Update the secret word in `index.ts`:

```typescript
const GROUP_CONFIG = {
  secretWord: "YOUR_SECRET_WORD_HERE",
  // ...
};
```

3. Start the agent:

```bash
yarn dev
```

## Usage

Send the secret passphrase to the agent to join the group. The default passphrase is "XMTP2024".

## Environment Variables

- `WALLET_KEY` - Your wallet private key
- `ENCRYPTION_KEY` - Database encryption key
- `XMTP_ENV` - Network environment (dev, production, local)
