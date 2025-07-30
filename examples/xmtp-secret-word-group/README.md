# XMTP secret word group example

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

```json
// Configuration for the secret word gated group
const GROUP_CONFIG = {
  // The secret passphrase users must provide to join
  secretWord: SECRET_WORD,
  // Group details
  groupName: "Secret Word Gated Group",
  groupDescription: "A group that requires a secret passphrase to join",

  // Messages
  messages: {
    welcome:
      "Hi! I can add you to our exclusive group. What's the secret passphrase?",
    success: [
      "🎉 Correct! You've been added to the group.",
      "Welcome to our exclusive community!",
      "Please introduce yourself and follow our community guidelines.",
    ],
    alreadyInGroup: "You're already in the group!",
    invalid: "❌ Invalid passphrase. Please try again.",
    error: "Sorry, something went wrong. Please try again.",
    help: "Send me the secret passphrase to join our exclusive group!",
  },
};
```

3. Start the agent:

```bash
yarn dev
```

## Usage

Send the secret passphrase to the agent to join the group. The default passphrase is "XMTP2024".

## Environment Variables

- `SECRET_WORD` - The secret word to join the group
- `WALLET_KEY` - Your wallet private key
- `ENCRYPTION_KEY` - Database encryption key
- `XMTP_ENV` - Network environment (dev, production, local)
