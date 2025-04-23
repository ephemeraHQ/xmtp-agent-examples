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

Wrap the stream in a promise and return it to restart the stream.

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
