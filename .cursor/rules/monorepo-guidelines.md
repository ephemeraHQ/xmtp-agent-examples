# Working with XMTP Agents in this Monorepo

This guide provides comprehensive instructions for developing, testing, and debugging XMTP agents using the test-cli tool and running agents successfully in the monorepo environment.

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

Standard scripts configuration:

```json
{
  "scripts": {
    "build": "tsc",
    "test-cli": "tsx ../../scripts/test-cli.ts",
    "clean": "cd ../../ && rm -rf examples/xmtp-gm/.data",
    "dev": "tsx --watch src/index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-gm",
    "start": "tsx src/index.ts"
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
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
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

Here's how the correct package.json should look for a simple agent:

```json
{
  "name": "@examples/xmtp-agent-name",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test-cli": "tsx ../../scripts/test-cli.ts",
    "dev": "tsx --watch index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-agent-name",
    "start": "tsx index.ts"
  },
  "dependencies": {
    "@xmtp/node-sdk": "*" // Inherit the version from the root package.json
    /* other dependencies */
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
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

## Developing and Running Agents

### Starting an Agent for Development

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

> **⚠️ Important:**
>
> - Always use `yarn dev` during development as it enables hot-reloading
> - The `yarn start` script is primarily intended for production use
> - Never use npx or direct tsx commands, always use yarn scripts
> - Always run commands from the agent directory, not from the project root

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

### Running with Logging (Recommended)

For proper debugging, always run agents with output redirected to a logfile:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Run the agent with output redirected to a logfile
yarn dev > agent.log 2>&1 &
echo $! > agent.pid

# To stop the agent later
kill $(cat agent.pid)
```

## Testing XMTP Agents

The test-cli tool provides a simple way to test your agents without additional setup.

### Using test-cli to Send Messages

In a separate terminal window, use the test-cli to send test messages to your agent:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Send a message to your agent
# Usage: yarn test-cli <network> <target_address> <message>
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Test message"
```

> **Note:** `test-cli` uses default keys for testing, so it doesn't require an .env file to run. It has built-in defaults for WALLET_KEY and ENCRYPTION_KEY.

Expected output:

```
Sending message to 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f: "Test message"
Connected as: 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Inbox ID: f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751
Creating conversation with 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f...
Sending message...
Message sent successfully!
```

### Analyzing Agent Responses

To verify the agent is working correctly, check the logfile:

```bash
# View the entire log
cat agent.log

# Follow new log entries in real-time
tail -f agent.log
```

### Complete Testing Example

Here's a complete example for testing a number multiplier agent:

```bash
# Terminal 1: Start the agent with logging
cd examples/xmtp-number-multiplier
yarn dev > agent.log 2>&1 &
echo $! > agent.pid

# Terminal 2: Send test messages
cd examples/xmtp-number-multiplier
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "99.5"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Hello agent"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "-25"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "1.5e3"

# Terminal 3: Check the logs to verify agent behavior
tail -f agent.log

# When done, stop the agent
kill $(cat agent.pid)
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

## Working with Different Networks

XMTP supports three network environments:

1. **dev** - Testing network hosted by XMTP (default)
2. **production** - Production network hosted by XMTP
3. **local** - Self-hosted local network for development

### Using the Web Inbox

Interact with the XMTP network using [xmtp.chat](https://xmtp.chat), the official web inbox for developers. The agent URL shown in the startup banner will direct you to your agent in the web inbox.

### Setting Up a Local Network

To use the local network for development:

1. Install Docker if not already installed
2. Start the XMTP service and database:
   ```bash
   ./dev/up
   ```
3. Update your `.env` file to use the local network:
   ```
   XMTP_ENV=local
   ```

## Troubleshooting

If your agent doesn't respond as expected, check the following:

### Agent Running Issues

- **Check if the agent is running:**
  ```bash
  ps -ef | grep tsx
  ```
- **Look for errors in the logfile:**
  ```bash
  grep -i error agent.log
  ```
- **Verify database permissions:**
  ```bash
  ls -la *.db3
  ```

### Communication Issues

- **Verify the agent address** is correct when using test-cli
- **Check network connectivity** to the XMTP network
- **Confirm environment variables** are correctly set in .env
- **Inspect conversation history** in the web inbox

### Common Errors and Solutions

| Error                            | Possible Solution                               |
| -------------------------------- | ----------------------------------------------- |
| "Cannot connect to XMTP network" | Check network connectivity and XMTP_ENV setting |
| "Failed to create conversation"  | Verify target address is correct and valid      |
| "Error: SQLITE_CANTOPEN"         | Check database file permissions                 |
| "Invalid private key"            | Regenerate keys with `yarn gen:keys`            |
| Agent not responding             | Restart agent and check logs for errors         |
