# XMTP CLI Tools

Command-line tools for interacting with XMTP. Built with [Ink](https://github.com/vadimdemedes/ink) - React for CLIs.

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

# Chat directly with a specific agent (by Ethereum address)
yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2

# Chat directly with a specific agent (by inbox ID)
yarn chat --agent 1180478fde9f6dfd4559c25f99f1a3f1505e1ad36b9c3a4dd3d5afb68c419179
```

**Features:**

- 🎨 Built with React components (Ink framework)
- 💬 Select from your conversations (DMs and Groups)
- 🤖 Connect directly to an agent using `--agent` flag
- ✨ Auto-creates DM if no existing conversation found
- 🔄 Real-time message streaming
- 🎯 Beautiful boxed input field UI
- 🔀 Switch between conversations without leaving the app
- 🌈 Color-coded display (You vs Others)
- 📜 Message history with scrolling
- 💾 Persisted identity (stored in DB)

**In-chat commands:**

- `/conversations` - List all your conversations with quick-access numbers
- `/chat <number>` - Switch to a different conversation (e.g., `/chat 2`)
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

## Architecture

The CLI is built with a modular React-based architecture using Ink:

```
cli/
├── chat.tsx                    # Main entry point
├── xmtp-client.ts             # XMTP client wrapper (encapsulated)
├── types.ts                   # Shared TypeScript types
├── constants.ts               # Global constants (colors, etc.)
└── components/
    ├── Header.tsx             # Client info banner
    ├── ConversationList.tsx   # Conversation selection
    ├── ChatView.tsx           # Main chat interface
    ├── MessageList.tsx        # Message display
    └── InputBox.tsx           # Message input
```

**Benefits:**

- Clean separation of concerns (XMTP logic separate from UI)
- Reusable React components
- Easy to test and extend
- Better state management with React hooks

## Notes

- The CLI uses the same identity (WALLET_KEY) each time you run it
- To use a different identity, change the WALLET_KEY in `.env`
- To reset and create a new identity, delete the `.db3` files
- Messages are streamed in real-time as they arrive
- Built with [Ink](https://github.com/vadimdemedes/ink) for terminal rendering
