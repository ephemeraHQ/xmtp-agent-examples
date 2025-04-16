# Testing XMTP agents

This rule provides guidance on testing and debugging XMTP agents using the test-cli tool and running agents successfully.

## Setting up packages and scripts in examples from this monorepo

1. These guidelines are specifically for configuring package.json files in this monorepo's examples.
2. Do not create separate tsconfig.json files as the root configuration will be used.
3. Use proper package naming convention. Respect the following structure:

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

## Starting an agent

When developing XMTP agents, it's essential to test them properly. This guide shows the process of setting up and testing an XMTP agent using the test-cli tool.

> **Important**:
>
> - Always use `yarn dev` during development as it enables hot-reloading. The `yarn start` script is primarily intended for production use cases.
> - Never use npx or direct tsx commands, always use yarn scripts
> - Always run test-cli from the agent directory, not from the project root
> - Default to this method only for testing.

1. Start your agent in a terminal window:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Install dependencies if needed
yarn install

# Start the agent with hot-reloading (ALWAYS use this for development)
yarn dev
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
