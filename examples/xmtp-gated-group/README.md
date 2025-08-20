# XMTP gated group example

An XMTP agent that creates a group that requires a secret passphrase to join.

1. Users send a message to the agent
2. The agent checks if the message matches the secret passphrase
3. If correct, the user is added to an exclusive group
4. If incorrect, the user gets an error message

> [!IMPORTANT]
> Because of XMTP's security guarantees, you need to add the bot to the group manually and make it an admin.

## Getting Started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network testing)

### Environment Variables

To run your XMTP agent, create a `.env` file with the following variables:

```bash
SECRET_WORD= # the secret word to join the group
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

Generate random XMTP keys with:

```bash
yarn gen:keys
```

> [!WARNING]
> The `gen:keys` command appends keys to your existing `.env` file.

## Usage

1. Update the secret word in `index.ts`:

```tsx
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

### Running the Agent

```bash
# Clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# Navigate to the secret word group example directory
cd xmtp-agent-examples/examples/xmtp-secret-word-group
# Install dependencies
yarn
# Generate random XMTP keys (optional)
yarn gen:keys
# Run the example
yarn dev
```
