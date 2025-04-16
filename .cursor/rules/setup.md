# Debugging XMTP agents

This rule provides guidance on testing and debugging XMTP agents using the test-cli tool and running agents successfully.

## Setting up packages and scripts in examples from this monorepo

1. These guidelines are specifically for configuring package.json files in this monorepo's examples.
2. Do not create separate tsconfig.json files as the root configuration will be used.
3. Use proper package naming convention:

```json
{
  "name": "@examples/xmtp-agent-name"
}
```

4. Always include these standard fields:

```json
{
  "version": "0.0.1",
  "private": true,
  "type": "module"
}
```

5. Standard scripts configuration:

```json
{
  "scripts": {
    "build": "tsc",
    "test-cli": "tsx ../../scripts/test-cli.ts",
    "dev": "tsx --watch src/index.ts",
    "gen:keys": "tsx ../../scripts/generateKeys.ts",
    "lint": "cd ../.. && yarn eslint examples/xmtp-gm",
    "start": "tsx src/index.ts"
  }
}
```

> **Important**: Always use `yarn dev` during development as it enables hot-reloading. The `yarn start` script is primarily intended for production use cases.

6. Dependencies:

- Use exact version of @xmtp/node-sdk (not ^)

```json
{
  "dependencies": {
    "@xmtp/node-sdk": "2.0.2"
    /* other dependencies */
  }
}
```

7. DevDependencies:

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

8. Package manager and engine specifications:

```json
{
  "engines": {
    "node": ">=20"
  }
}
```

9. Here's how the correct package.json should look for a simple agent:

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
    "@xmtp/node-sdk": "2.0.2"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  },
  "packageManager": "yarn@4.6.0",
  "engines": {
    "node": ">=20"
  }
}
```

## Testing XMTP agents with test-cli

When developing XMTP agents, it's essential to test them properly. This guide shows the process of setting up and testing an XMTP agent using the test-cli tool.

### Setup process

1. Create your agent in a directory under `examples/`:

   ```bash
   mkdir -p examples/your-agent-name
   ```

2. Create the necessary files for your agent:

   - `package.json`
   - `index.ts` (main agent code)

3. Generate keys for your agent:

   ```bash
   # remember to install
   yarn install
   # From the project root:
   yarn gen:keys
   ```

4. Copy the environment variables to your agent's `.env` file:

   ```bash
   # Create .env file in your agent directory
   cd examples/your-agent-name

   # Example .env content:
   XMTP_ENV=dev
   WALLET_KEY=0x0d8445a55b9cdf8b423e5eb90f2e0b3a045a8f40b1cade05fcd0d939b0ad62ef
   ENCRYPTION_KEY=e18d283046c79e24a7acd9cd58d6931d5ca6798c99020ea397a3e22b45ab8859
   # public key is 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f
   ```

### Running the agent

Start your agent in a terminal window:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Install dependencies if needed
yarn install

# Start the agent with hot-reloading (ALWAYS use this for development)
yarn dev

# DO NOT use the following for development
# yarn start  # No hot-reloading, only for production
```

You should see output similar to:

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

**Confirming the agent is running and stopping the terminal**

Once you see the "Waiting for messages..." message, the agent is fully initialized and ready to receive messages. At this point:

1. Verify all agent details are correct and the agent is connected to the expected network (dev/production)
2. If you need to stop the agent, you can:
   - Press `Ctrl+C` to terminate the process in the terminal
   - Click the "Cancel" button in the terminal window
   - Use the "Pop out terminal" button to move the terminal to a separate window if you need it to continue running while working on other files

Keep the agent running if you plan to send test messages to it. Only stop it when you need to make code changes that require a restart or when you're done testing.

### Testing with test-cli

In a separate terminal window, use the test-cli to send test messages to your agent:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Send a message to your agent
# Make sure to use the public key from your agent's .env file
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Test message"
```

> Note: test-cli uses default keys for testing, so it doesn't require an .env file to run. It has built-in defaults for WALLET_KEY and ENCRYPTION_KEY.
>
> IMPORTANT: Always run the test-cli command directly from the agent directory. Do NOT use `cd ..` before the command, as the script already contains the correct relative path `../../scripts/test-cli.ts`.

Expected output:

```
Sending message to 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f: "Test message"
Connected as: 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Inbox ID: f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751
Creating conversation with 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f...
Sending message...
Message sent successfully!
```

### Observing agent behavior

In the terminal where your agent is running, you should see logs showing:

1. Message reception
2. Processing logic
3. Response actions

Example output from a number multiplier agent:

```
Received message: 42
Multiplied 42 by 2: 84
Creating group "Multiplier result for 42" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for 42" created successfully and result sent
```

## Common issues and solutions

### Problem: Agent can't start due to missing environment variables

Error:

```
Missing env vars: WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV
```

Solution:

1. Make sure you've created a `.env` file in your agent directory
2. Verify it contains all required variables:
   ```
   XMTP_ENV=dev
   WALLET_KEY=0x...
   ENCRYPTION_KEY=...
   ```

### Problem: Package not found errors

Error:

```
Internal Error: Package for @examples/your-agent-name@workspace:examples/your-agent-name not found in the project
```

Solution:

1. Make sure your `package.json` has the correct name field:
   ```json
   {
     "name": "@examples/your-agent-name"
   }
   ```
2. Run `yarn install` from the project root

### Problem: test-cli can't send messages to the agent

Error:

```
Error sending message: storage error: inbox id for address 0x... not found
```

Solution:

1. Make sure your agent is running
2. Verify you're using the correct public key from the agent's `.env` file
3. Check that you're using the same XMTP environment in both your agent and test-cli

## Testing different input types

To thoroughly test your agent, send various types of input:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Test with different data types
yarn test-cli YOUR_AGENT_ADDRESS "42"  # integer
yarn test-cli YOUR_AGENT_ADDRESS "3.14"  # decimal
yarn test-cli YOUR_AGENT_ADDRESS "-10"  # negative number
yarn test-cli YOUR_AGENT_ADDRESS "Hello"  # text
yarn test-cli YOUR_AGENT_ADDRESS "1.5e3"  # scientific notation (1500)
```

## Debugging tips

1. Add detailed logging to your agent code to track message processing
2. Use two terminal windows: one for the agent and one for sending test messages
3. Examine the agent's database file (`.db3`) for persistent data
4. If you update your agent code, restart the agent to apply changes
5. Always use `yarn dev` for development, never use `yarn start` directly

## Example: testing a number multiplier agent

```bash
# Terminal 1: Start the agent
cd examples/xmtp-number-multiplier
yarn dev

# Terminal 2: Send test messages
cd examples/xmtp-number-multiplier
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "99.5"
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Hello agent"
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "-25"
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "1.5e3"
```

- Never use npx or direct tsx commands, always use yarn scripts
- Always run test-cli from the agent directory, not from the project root
- Always use `yarn dev` for development to enable hot-reloading, never use `yarn start`

Terminal 1 output:

```
Received message: 99.5
Multiplied 99.5 by 2: 199
Creating group "Multiplier result for 99.5" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for 99.5" created successfully and result sent

Received message: Hello agent

Received message: -25
Multiplied -25 by 2: -50
Creating group "Multiplier result for -25" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for -25" created successfully and result sent

Received message: 1.5e3
Multiplied 1500 by 2: 3000
Creating group "Multiplier result for 1500" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for 1500" created successfully and result sent
```
