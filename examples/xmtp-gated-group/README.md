# Gated group chat example

An XMTP agent that creates a group that requires a secret passphrase to join.

1. Users send a message to the agent
2. The agent checks if the message matches the secret passphrase
3. If correct, the user is added to an exclusive group
4. If incorrect, the user gets an error message

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

## Getting started

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryption
XMTP_ENV=dev # local, dev, production
GAIA_API_KEY= # Your API key from https://gaianet.ai
GAIA_NODE_URL= # Your custom Gaia node URL or a public node, ex: https://llama8b.gaia.domains/v1
GAIA_MODEL_NAME= # Model name running in your Gaia node or a public node, ex: llama
```

### Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/xmtp-gated-group
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
