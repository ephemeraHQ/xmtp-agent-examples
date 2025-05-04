# XMTP deployment example

This PR introduces a self-served deployment-ready solution that handles common challenges developers face when implementing WebSocket applications:

- [x] Stream restarts with automatic reconnection
- [x] Welcome messages
- [x] Conversation synchronization across instances
- [x] Group messaging functionality (optional)
- [x] Railway deployment configuration
- [x] Support for multiple clients
- [x] Optional content type handling

By providing this standardized implementation, we can:

- Reduce repetitive questions from developers
- Establish a consistent baseline for all implementations
- Simplify debugging by ensuring everyone follows the same approach
- Prevent collateral damage from developers who don't fully understand these concepts

Not included:

- Processing messages in a queue, for that we have a specific example

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
cd examples/xmtp-deployment-example
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
