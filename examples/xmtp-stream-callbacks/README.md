# XMTP Stream Callbacks

Demonstrates XMTP SDK streaming with comprehensive callback logging and retry configuration.

## Setup

```bash
# Generate keys
yarn gen:keys

# Start agent
yarn dev
```

## Features

- Configurable retry behavior (attempts, delays)
- Comprehensive callback logging (onValue, onError, onFail, onRetry, onRestart, onEnd)
- Automatic stream recovery on network issues

## Usage

Send a message to the agent to see callback logging in action. The agent responds with "gm" to all text messages.

## Configuration

```typescript
const stream = await client.conversations.streamAllMessages({
  retryAttempts: 3,
  retryDelay: 5000,
  retryOnFail: true,
  onValue: async (message) => {
    /* process message */
  },
  onError: (error) => {
    /* handle error */
  },
  onFail: () => {
    /* stream failed */
  },
  onRetry: (attempts, maxAttempts) => {
    /* retry attempt */
  },
  onRestart: () => {
    /* stream restarted */
  },
  onEnd: () => {
    /* stream ended */
  },
});
```
