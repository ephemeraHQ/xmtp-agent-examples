# XMTP Skills

All streaming methods accept a callback as the last argument that will be called when the stream fails. Use this callback to restart the stream.

An example of how to use the callback to restart the stream:

```typescript
const MAX_RETRIES = 5;
// wait 5 seconds before each retry
const RETRY_INTERVAL = 5000;

let retries = MAX_RETRIES;

const retry = () => {
  console.log(`Retrying in ${RETRY_INTERVAL / 1000}s, ${retries} retries left`);
  if (retries > 0) {
    retries--;
    setTimeout(() => {
      handleStream(client);
    }, RETRY_INTERVAL);
  } else {
    console.log("Max retries reached, ending process");
    process.exit(1);
  }
};

const onFail = () => {
  console.log("Stream failed");
  retry();
};

const handleStream = async (client) => {
  console.log("Syncing conversations...");
  await client.conversations.sync();

  const stream = await client.conversations.streamAllMessages(
    void onMessage,
    undefined,
    undefined,
    onFail,
  );

  console.log("Waiting for messages...");
};

const onMessage = (err: Error | null, message?: DecodedMessage) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(`Received message from ${message.senderAddress}:`);
  console.log(`Content: ${message.content}`);
};

await handleStream(client);
```

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

```

```
