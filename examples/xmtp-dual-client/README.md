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

### Explanation

1. **Epochs in XMTP**:

   - Epochs represent versions of a group's membership and structure
   - Epochs only advance when structural changes occur (adding/removing members, changing permissions)
   - Regular message sending does not create new epochs
   - You can send hundreds of messages in the same epoch if no membership changes occur

2. **Sync Requirements**:

   - You don't need to run sync() before every message send
   - Messages will be sent directly without requiring sync first
   - XMTP allows decryption of messages from up to 3 epochs in the past

3. **Failure Conditions**:

   - Message sends will only fail if your installation is more than 3 epochs behind
   - This happens if there have been multiple membership/permission changes you haven't synced

4. **Optimal Approach**:

   - Periodic conversations.sync() is sufficient (rather than syncAll() every time)
   - Implement retry logic for sends that fail due to epoch mismatches
   - Use message streams for real-time updates with periodic sync as a safety net

5. **Efficient Implementation**:
   - Only sync when necessary rather than before every operation
   - Let retry mechanisms handle the occasional epoch-related failure
   - This balances reliability with performance
