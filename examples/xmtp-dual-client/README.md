# XMTP Dual Client Agent

This agent demonstrates the use of dual clients in XMTP.

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

### Running the Agent

```bash
# Clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# Navigate to the dual client example directory
cd xmtp-agent-examples/examples/xmtp-dual-client
# Install dependencies
yarn
# Generate random XMTP keys (optional)
yarn gen:keys
# Run the example
yarn dev
```

## Concepts

1. **Epochs in XMTP**: Represent group membership versions. Advance only with structural changes, not regular messaging.

2. **Sync requirements**: No need to sync before every message. XMTP decrypts messages from up to 3 epochs back.

3. **Failure conditions**: Messages fail only when more than 3 epochs behind due to unsynced membership changes.

4. **Optimal approach**: Use periodic conversations.sync(), implement retry logic, and combine with message streams.

5. **Efficient implementation**: Sync only when necessary, use retry mechanisms for occasional failures.
