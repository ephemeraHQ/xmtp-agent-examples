# Working with XMTP Agents in this Monorepo

This guide provides comprehensive instructions for developing, testing, and debugging XMTP agents using the test-manager tool and running agents successfully in the monorepo environment.

## Environment Setup

### Required Tools

- Node.js v20 or later
- Yarn v4.6.0 (package manager)
- Docker (for local network testing)

### Package Configuration

When creating new agent examples in this monorepo, follow these guidelines for consistent package.json configuration:

Use proper package naming convention:

```json
{
  "name": "@examples/xmtp-agent-name"
}
```

Always include these standard fields:

```json
{
  "version": "0.0.1",
  "private": true,
  "type": "module"
}
```

Standard scripts configuration with agent management:

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx --watch src/index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-agent-name",
    "start": "tsx src/index.ts",
    "test-manager": "tsx ../../scripts/test-manager.ts"
  }
}
```

Dependencies:

- Use exact version of @xmtp/node-sdk (not ^)

```json
{
  "dependencies": {
    "@xmtp/node-sdk": "*" // Inherit the version from the root package.json
    /* other dependencies */
  }
}
```

DevDependencies:

- Use tsx instead of ts-node
- Include specific versions

```json
{
  "devDependencies": {
    "tsx": "*",
    "typescript": "*"
  }
}
```

Package manager and engine specifications:

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

Here's how the correct package.json should look for a simple agent with agent management:

```json
{
  "name": "@examples/xmtp-agent-name",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx --watch src/index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-agent-name",
    "test-manager": "tsx ../../scripts/test-manager.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@xmtp/node-sdk": "*" // Inherit the version from the root package.json
    /* other dependencies */
  },
  "devDependencies": {
    "tsx": "*",
    "typescript": "*"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### Environment Variables

Your agent will typically require these environment variables in a `.env` file:

```bash
# Network: local, dev, or production
XMTP_ENV=dev

# Private keys (generate with yarn gen:keys)
WALLET_KEY=your_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
```

## Running an Agent

Always use the development script during active development for hot-reloading:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Install dependencies if needed
yarn install

# Generate keys if you don't have them
yarn gen:keys

# Start the agent with hot-reloading
yarn dev
```

When successfully started, you should see output similar to:

```
    ██╗  ██╗███╗   ███╗████████╗██████╗
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝

╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                         Agent Details                                        ║
╟──────────────────────────────────────────────────────────────────────────────────────────────╢
║ 📍 Address: 0x41592a3a39ef582fa38c4062e8a3a23102f7f05f                                       ║
║ 📍 inboxId: a0974e5184a37d293b9825bbc7138897ffe457768b9b6ae6fe1f70ead1455da7                 ║
║ 📂 DB Path: ../your-agent-name/xmtp-dev-0x41592a3a39ef582fa38c4062e8a3a23102f7f05f.db3       ║
║ 🛜  Network: dev                                                                              ║
║ 🔗 URL: http://xmtp.chat/dm/0x41592a3a39ef582fa38c4062e8a3a23102f7f05f?env=dev               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
✓ Syncing conversations...
Waiting for messages...
```

## Testing an Agent

### Running with Logging (Recommended)

```bash
# Start the agent with logging
yarn test-manager start

# Check agent status
yarn test-manager status

# View live logs
yarn test-manager logs

# Stop the agent
yarn test-manager stop
```

These commands will handle absolute paths, proper logging, and process management automatically.

### Using test-manager to Send Messages

In a separate terminal window, use the test-manager to send test messages to your agent:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Send a message to your agent
# Usage: yarn test-manager send <network> <target_address> 'message'
yarn test-manager send dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f 'message'
```

> **Note:** `test-manager` uses default keys for testing, so it doesn't require an .env file to run. It has built-in defaults for WALLET_KEY and ENCRYPTION_KEY.

Expected output:

```
Network: dev
Sending message to 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f: "Test message"
Address: 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Inbox ID: f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751
Creating conversation with 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f...
Sending message...
Message sent successfully!
```

## Complete Testing Example

Here's a complete example for testing a number multiplier agent using the test-manager script and yarn commands:

```bash
# Terminal 1: Start the agent with logging using yarn commands
cd examples/xmtp-number-multiplier
yarn test-manager start

# Terminal 2: Send test messages
cd examples/xmtp-number-multiplier
yarn test-manager send dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f '99.5'
yarn test-manager send dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f 'Hello agent'
yarn test-manager send dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f '-25'
yarn test-manager send dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f '1.5e3'

# Terminal 3: Check the logs
yarn test-manager logs

# When done, stop the agent
yarn test-manager stop
```

Example `agent.log` content:

```
    ██╗  ██╗███╗   ███╗████████╗██████╗
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝

╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                         Agent Details                                        ║
╟──────────────────────────────────────────────────────────────────────────────────────────────╢
║ 📍 Address: 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f                                       ║
║ 📍 inboxId: a0974e5184a37d293b9825bbc7138897ffe457768b9b6ae6fe1f70ead1455da7                 ║
║ 📂 DB Path: ../xmtp-number-multiplier/xmtp-dev-0x41592a3a39ef582fa38c4062e8a3a23102f7f05f.db3║
║ 🛜  Network: dev                                                                              ║
║ 🔗 URL: http://xmtp.chat/dm/0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f?env=dev               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
✓ Syncing conversations...
Waiting for messages...
Received number: 99.5, multiplied result: 199
Creating group with sender 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Group created and message sent successfully
Received non-number message: Hello agent
Received number: -25, multiplied result: -50
Creating group with sender 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Group created and message sent successfully
Received number: 1500, multiplied result: 3000
Creating group with sender 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Group created and message sent successfully
```
