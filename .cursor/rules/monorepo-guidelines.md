# Working with XMTP agents in this monorepo

This is the monorepo for XMTP agents. It contains many examples of agents on XMTP.

### Required tools

- Node.js v20 or later
- Yarn v4.6.0 (package manager)
- Docker (for local network testing)

### Package configuration

When creating new agent examples in this monorepo, follow these guidelines for consistent package.json configuration:

```json
{
  "name": "@examples/xmtp-agent-name",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
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
    "tsx": "*",
    "typescript": "*"
  },
  "engines": {
    "node": ">=20"
  }
}
```

> **Note:** Ensure the script paths match your actual file structure. Some agents use `index.ts` in the root folder while others might use `src/index.ts`.

### Environment variables

Your agent will typically require these environment variables in a `.env` file:

```bash
# Network: local, dev, or production
XMTP_ENV=dev

# Private keys (generate with yarn gen:keys)
WALLET_KEY=your_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
```

## Running an agent

### Direct execution (recommended for development)

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
