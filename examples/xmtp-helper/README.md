# XMTP Helper

This example shows how to build XMTP agents using a helper pattern that separates XMTP logic from business logic.

## Features

- **Simple API**: Just write a message processing function
- **Automatic message filtering**: Skips messages from the agent itself and non-text messages
- **Stream retry mechanism**: Automatically retries failed message streams with configurable retries (5 attempts with 5-second intervals)
- **Address resolution**: Converts inbox IDs to Ethereum addresses automatically
- **Error handling**: Graceful error handling for message processing and sending

## Getting started

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher

### Environment variables

Create a `.env` file:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

Generate keys:

```bash
yarn gen:keys
```

### Run the agent

```bash
# Install dependencies
yarn install

# Generate keys (if needed)
yarn gen:keys

# Start the agent
yarn dev
```

## How it works

The helper encapsulates all XMTP complexity. You just write a function that processes messages:

```typescript
function processMessage(message: ProcessedMessage): string {
  console.log(`Received: ${message.content}`);
  return "gm"; // Your response
}

// Start the agent
XmtpHelper.createAndStart(config, processMessage);
```

That's it! The helper handles client initialization, message streaming, filtering, sending responses, and stream recovery if the connection fails.
