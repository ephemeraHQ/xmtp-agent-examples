# XMTP self-serve example

This example introduces a self-served deployment-ready solution that handles common challenges developers face when implementing xmtp agents:

- [x] Stream restarts
- [x] Welcome messages
- [x] Idle reconnect
- [x] Syncing conversations
- [x] Explicit group handling
- [x] Database path folder
- [x] Node workers
- [x] Railway volume mount
- [x] Multiple clients
- [x] Content types
- [x] Default key

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
ENCRYPTION_KEY= # encryption key for the local database (optional)
XMTP_ENV= # the environment to connect to (dev, production, local)
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
cd examples/xmtp-deployment-example
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

```tsx
import { validateEnvironment } from "@helpers/client";
import type { Client, Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { initializeClient } from "./xmtp-handler";

const { WALLET_KEY } = validateEnvironment(["WALLET_KEY"]);
const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
) => {
  console.log("Environment: ", client.options?.env);
  console.log("Agent address: ", client.accountIdentifier?.identifier);
  console.log("Message received from ", message.senderInboxId);
  console.log("Message content: ", message.content);
  console.log("Is DM: ", isDm);
  console.log("Conversation ID: ", conversation.id);
  /**
   *
   * Your logic here
   * Reply to the message for example
   *
   * await conversation.send("gm");
   */
};

await initializeClient(processMessage, [
  {
    acceptGroups: true,
    walletKey: WALLET_KEY,
  },
]);
```
