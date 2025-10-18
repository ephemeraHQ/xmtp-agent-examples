# XMTP CLI Tools

Command-line tools for interacting with XMTP.

## Setup

1. Generate keys:

```bash
yarn gen:keys
```

2. Copy credentials to `.env`:

```bash
XMTP_ENV=production          # or dev, local
WALLET_KEY=0x...            # Your wallet private key
ENCRYPTION_KEY=...          # Your DB encryption key
```

## Interactive Chat

Chat with XMTP conversations directly from your terminal:

```bash
# Use default environment
yarn chat

# Specify environment
yarn chat --env dev
yarn chat --env local
```

**Features:**

- Select from your conversations (DMs and Groups)
- Real-time message streaming
- Send messages with a simple interface
- Color-coded display (You vs Others)
- Message history
- Persisted identity (stored in DB)

**In-chat commands:**

- `/back` - Return to conversation list
- `/exit` - Quit the app

## Query Tools

Read-only tools for inspecting XMTP data:

```bash
# List all conversations
yarn mock conversations --env production

# View messages in a conversation
yarn mock messages <conversation-id> --env dev

# Check your identity
yarn mock identity --env local
```

## Notes

- The CLI uses the same identity (WALLET_KEY) each time you run it
- To use a different identity, change the WALLET_KEY in `.env`
- To reset and create a new identity, delete the `.db3` files
- Messages are streamed in real-time as they arrive
