# Inline Actions Example

An XMTP agent demonstrating interactive inline actions using XIP-67 standards with a clean middleware and utilities approach.

<p align="center">
  <img src="media/left.png" alt="Image 1" width="49%">
  <img src="media/right.png" alt="Image 2" width="49%">
</p>

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

## Features

This example showcases:

- **Interactive Menu System**: Hierarchical action menus with navigation
- **Confirmation Flows**: Multi-step confirmation for sensitive actions
- **Selection Menus**: Dynamic option selection with custom styling
- **Middleware Architecture**: Clean separation of action handling logic
- **Utility Functions**: Reusable components for common action patterns

### Available Actions

| Action            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `start` or `menu` | Display the main interactive menu              |
| **Menu Options:** |                                                |
| 💸 Send Money     | Show money transfer options with confirmations |
| 💰 Check Balance  | Display mock account balance                   |
| ❓ Help           | Show help information with navigation          |

## Technical Implementation

### Middleware Usage

The agent uses the `inlineActionsMiddleware` to automatically handle intent messages:

```typescript
import { inlineActionsMiddleware } from "../../utils/inline-actions/inline-actions";

// Add middleware to agent
agent.use(inlineActionsMiddleware);
```

### Action Registration

Actions are registered using the utility functions:

```typescript
import {
  ActionBuilder,
  registerAction,
  sendActions,
} from "../../utils/inline-actions/inline-actions";

// Register an action handler
registerAction("show-menu", async (ctx) => {
  const menu = ActionBuilder.create(
    "main-menu",
    "🎯 What would you like to do?",
  )
    .add("send-money", "💸 Send Money")
    .add("check-balance", "💰 Check Balance")
    .add("get-help", "❓ Help")
    .build();

  await sendActions(ctx, menu);
});
```

### Utility Functions

The example demonstrates various utility functions:

```typescript
// Send confirmation dialog
await sendConfirmation(
  ctx,
  "Send 0.01 USDC to the bot?",
  "confirm-send-small",
  "cancel-send",
);

// Send selection menu
await sendSelection(ctx, "💸 How much would you like to send?", [
  { id: "send-small", label: "0.01 USDC" },
  { id: "send-medium", label: "0.1 USDC" },
  { id: "send-large", label: "1 USDC" },
]);
```

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
NETWORK_ID=base-sepolia # base-mainnet or others
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
cd examples/xmtp-inline-actions
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Reference

This example is based on the [TBA Chat Example Bot](https://github.com/siwan-cb/tba-chat-example-bot).
