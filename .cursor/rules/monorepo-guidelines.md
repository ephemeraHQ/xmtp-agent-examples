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

Standard scripts configuration with agent management:

```json
{
  "scripts": {
    "build": "tsc",
    "test-cli": "tsx ../../scripts/test-cli.ts",
    "clean": "cd ../../ && rm -rf examples/xmtp-agent-name/.data",
    "dev": "tsx --watch src/index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-agent-name",
    "start": "tsx src/index.ts",
    "agent:start": "./agent-manager.sh start",
    "agent:stop": "./agent-manager.sh stop",
    "agent:status": "./agent-manager.sh status",
    "agent:logs": "./agent-manager.sh logs"
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

Here's how the correct package.json should look for a simple agent with agent management:

```json
{
  "name": "@examples/xmtp-agent-name",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test-cli": "tsx ../../scripts/test-cli.ts",
    "clean": "cd ../../ && rm -rf examples/xmtp-agent-name/.data",
    "dev": "tsx --watch src/index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-agent-name",
    "start": "tsx src/index.ts",
    "agent:start": "./agent-manager.sh start",
    "agent:stop": "./agent-manager.sh stop",
    "agent:status": "./agent-manager.sh status",
    "agent:logs": "./agent-manager.sh logs"
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

For proper debugging and management of your agent processes, download the agent-manager.sh script and use it through yarn commands:

1. **Download the agent-manager.sh script** to your agent directory

2. **Use yarn commands to manage your agent**:

```bash
# Start the agent with logging
yarn agent:start

# Check agent status
yarn agent:status

# View live logs
yarn agent:logs

# Stop the agent
yarn agent:stop
```

These commands will handle absolute paths, proper logging, and process management automatically.

## Testing XMTP Agents

XMTP provides tools for testing agents without additional setup.

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
Network: dev
Sending message to 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f: "Test message"
Address: 0x94dafa657d01247ff6094567eb54bdd2baf16c10
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

## Complete Testing Example

Here's a complete example for testing a number multiplier agent using the agent-manager script and yarn commands:

```bash
# Terminal 1: Start the agent with logging using yarn commands
cd examples/xmtp-number-multiplier
yarn agent:start

# Terminal 2: Send test messages
cd examples/xmtp-number-multiplier
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "99.5"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Hello agent"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "-25"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "1.5e3"

# Terminal 3: Check the logs
yarn agent:logs

# When done, stop the agent
yarn agent:stop
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

- **Check if the agent is running using the PID file:**

  ```bash
  # Verify the process is running
  ps -p $(cat agent.pid)

  # Alternative if PID file is missing
  ps -ef | grep tsx
  ```

- **Find the log file if it's not in the expected location:**

  ```bash
  # Move up one directory and search
  cd .. && find . -name "agent.log" -type f

  # Search from root directory if necessary
  find / -name "agent.log" -type f 2>/dev/null
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

| Error                                     | Possible Solution                                 |
| ----------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| "Cannot connect to XMTP network"          | Check network connectivity and XMTP_ENV setting   |
| "Failed to create conversation"           | Verify target address is correct and valid        |
| "Error: SQLITE_CANTOPEN"                  | Check database file permissions                   |
| "Invalid private key"                     | Regenerate keys with `yarn gen:keys`              |
| "No such file or directory" for log files | Use absolute paths when redirecting output        |
| Agent log in unexpected location          | Start from agent directory and use absolute paths |
| Agent not responding                      | Restart agent and check logs for errors           |
| Multiple agent processes running          | Use `ps -ef                                       | grep tsx` to find and kill old processes |

### Process and File Management Best Practices

To avoid common issues with file paths and process management:

1. **Always use absolute paths** for log files and PID files:

   ```bash
   # Get current directory
   AGENT_DIR=$(pwd)

   # Use absolute paths for all files
   yarn dev > "$AGENT_DIR/agent.log" 2>&1 &
   ```

2. **Always verify** that your agent is running and logging properly:

   ```bash
   # Check if process is running
   ps -p $(cat agent.pid)

   # Check if log file exists and has content
   ls -la agent.log
   tail -10 agent.log
   ```
