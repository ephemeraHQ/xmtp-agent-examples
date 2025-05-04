# Multiple clients example

This example demonstrates how to run multiple XMTP clients simultaneously using [XMTP](mdc:https:/xmtp.org) for secure messaging. You can test your agents on [xmtp.chat](mdc:https:/xmtp.chat) or any other XMTP-compatible client.

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agents, you must create a `.env` file with the following variables:

```bash
XMTP_ENV=dev # local, dev, production

# XMTP keys for agent 1
WALLET_KEY_AGENT1= # the private key of the wallet
ENCRYPTION_KEY_AGENT1= # encryption key for local db encryption

# XMTP keys for agent 2
WALLET_KEY_AGENT2= # the private key of the wallet
ENCRYPTION_KEY_AGENT2= # encryption key for local db encryption

# XMTP keys for agent 3
WALLET_KEY_AGENT3= # the private key of the wallet
ENCRYPTION_KEY_AGENT3= # encryption key for local db encryption
```

You can generate random xmtp keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.
> You will need to rename the vars for it to work with the example.

### Run the agents

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/xmtp-multiple-workers
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

This example demonstrates how to run multiple XMTP clients simultaneously

```tsx
const workerConfigs: WorkerConfig[] = [
  {
    name: "agent1",
    walletKey: WALLET_KEY_AGENT1,
    encryptionKey: ENCRYPTION_KEY_AGENT1,
    xmtpEnv: XMTP_ENV as XmtpEnv,
  },
  {
    name: "agent2",
    walletKey: WALLET_KEY_AGENT2,
    encryptionKey: ENCRYPTION_KEY_AGENT2,
    xmtpEnv: XMTP_ENV as XmtpEnv,
  },
  {
    name: "agent3",
    walletKey: WALLET_KEY_AGENT3,
    encryptionKey: ENCRYPTION_KEY_AGENT3,
    xmtpEnv: XMTP_ENV as XmtpEnv,
  },
];

// Create worker manager and initialize workers
console.log("Initializing XMTP client workers...");
const workers = await createXmtpWorkers(workerConfigs);

// Start message streams for all workers
console.log("Starting message streams for all workers...");

await Promise.all([
  workers.startMessageStream("agent1", gmMessageHandler),
  workers.startMessageStream("agent2", gmMessageHandler),
  workers.startMessageStream("agent3", gmMessageHandler),
]);
```
