# XMTP dual client queue example

A simple demonstration of using two separate XMTP clients: one for receiving messages and another for sending queued responses.

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
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

Generate random XMTP keys with:

```bash
yarn gen:keys
```

> [!WARNING]
> The `gen:keys` command appends keys to your existing `.env` file.

### Running the Agent

```bash
# Clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# Navigate to the queue dual client example directory
cd xmtp-agent-examples/examples/xmtp-queue-dual-client
# Install dependencies
yarn
# Generate random XMTP keys (optional)
yarn gen:keys
# Run the example
yarn dev
```
