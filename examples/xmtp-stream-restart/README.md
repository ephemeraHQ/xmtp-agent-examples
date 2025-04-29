# Stream restart example

This agent restarts the stream when it errors.

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

You can generate random xmtp keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

### Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/xmtp-stream-restart
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

### Basic stream restart

Cancelling a stream will restart it.

```tsx
const streamPromise = client.conversations.streamAllMessages();
const stream = await streamPromise;

stream.onError = (error) => {
  console.error("Stream error:", error);
};
stream.onReturn = () => {
  console.log("Stream returned");
};
console.log("Waiting for messages...");
const result = await stream.return(undefined);
console.log("Stream returned", result);
```

### Automatic retry logic

This example implements a robust retry mechanism with configurable parameters:

```tsx
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 10000;

// Helper function to pause execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let retryCount = 0;

while (retryCount < MAX_RETRIES) {
  try {
    console.log(
      `Starting message stream... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
    );
    const streamPromise = client.conversations.streamAllMessages();
    const stream = await streamPromise;

    console.log("Waiting for messages...");
    for await (const message of stream) {
      // Process messages here
    }

    // If we get here without an error, reset the retry count
    retryCount = 0;
  } catch (error) {
    retryCount++;
    console.error(
      `Stream processing error (attempt ${retryCount}/${MAX_RETRIES}):`,
      error,
    );

    if (retryCount < MAX_RETRIES) {
      console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
      await sleep(RETRY_DELAY_MS);
    } else {
      console.log("Maximum retry attempts reached. Exiting.");
    }
  }
}
```

Key features of the retry logic:

- Configurable maximum retry attempts (`MAX_RETRIES`)
- Customizable delay between retries (`RETRY_DELAY_MS`)
- Reset of retry counter when stream processes successfully
- Graceful error handling with detailed logging

### Simple continuous restart

For simpler use cases, you can wrap the stream in a promise and return it to restart the stream:

```tsx
while (true) {
  try {
    console.log("Starting message stream...");
    const streamPromise = client.conversations.streamAllMessages();
    const stream = await streamPromise;

    console.log("Waiting for messages...");
    for await (const message of stream) {
      // handle message
    }
  } catch (error) {
    console.error("Stream error:", error);
  }
}
```
