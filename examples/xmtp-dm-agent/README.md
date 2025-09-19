# XMTP DM Agent

A simple XMTP agent that only responds to direct messages (DMs), demonstrating how to handle DM-specific interactions and ignore group messages.

## Features

- **DM-only responses**: Only responds to direct messages, ignores group messages
- **Message echoing**: Echoes back received messages with additional context
- **Reaction handling**: Responds to reactions in DMs
- **Reply handling**: Handles replies to previous messages
- **Conversation tracking**: Logs conversation details and sender information

## Setup

1. **Install dependencies:**

   ```bash
   yarn install
   ```

2. **Generate keys:**

   ```bash
   yarn gen:keys
   ```

3. **Configure environment:**
   Create a `.env` file with:

   ```bash
   # Network: local, dev, or production
   XMTP_ENV=dev

   # Private keys (generated with yarn gen:keys)
   XMTP_WALLET_KEY=your_private_key_here
   XMTP_DB_ENCRYPTION_KEY=your_encryption_key_here
   ```

## Running the Agent

### Development (with hot-reloading)

```bash
yarn dev
```

### Production

```bash
yarn start
```

## How it Works

### DM Detection

The agent uses `ctx.isDm()` to check if a message is from a direct message conversation:

```typescript
agent.on("text", async (ctx) => {
  if (ctx.isDm()) {
    // Only respond to DMs
    await ctx.sendText("Hello from DM!");
  }
  // Group messages are ignored
});
```

### Event Handlers

- **`dm`**: Triggered when a new DM conversation starts
- **`text`**: Handles text messages in DMs only
- **`reaction`**: Responds to reactions in DMs
- **`reply`**: Handles replies to previous messages in DMs

### Message Context

Each handler receives a `MessageContext` with:

- `message`: The decoded message object
- `conversation`: The active conversation
- `client`: XMTP client instance
- Helper methods like `getSenderAddress()`, `sendText()`, etc.

## Example Interactions

### Starting a DM

When someone starts a DM with the agent:

```
👋 Hello! I'm a DM-only agent. I only respond to direct messages, not group messages.

You can send me any text message and I'll echo it back with some additional info!
```

### Text Message

When someone sends a text message:

```
📨 Message received!

Your message: "Hello there!"
From: 0x1234...abcd
Conversation ID: 1180478f...

This is a DM-only agent - I only respond to direct messages! 💬
```

### Reaction

When someone reacts to a message:

```
😊 Thanks for the reaction: 👍

I see you're engaging with my messages! Feel free to send me any text message.
```

### Reply

When someone replies to a previous message:

```
↩️ Reply received!

Your reply: "Thanks for the info!"
Replying to message: 1180478f...

Thanks for the reply! I'm here to help with any questions you might have.
```

## Key Concepts Demonstrated

1. **DM vs Group Detection**: Using `ctx.isDm()` to filter messages
2. **Event-driven Architecture**: Different handlers for different message types
3. **Context Access**: Getting sender address, conversation ID, and message content
4. **Error Handling**: Unhandled error logging
5. **Agent Lifecycle**: Start event logging with test URL

## Testing

Use the test URL provided when the agent starts to interact with it through the XMTP test interface. The agent will only respond to direct messages, making it perfect for testing DM-specific functionality.

## Extending the Agent

You can extend this agent by:

- Adding more sophisticated message processing
- Implementing conversation state management
- Adding middleware for cross-cutting concerns
- Integrating with external APIs
- Adding support for custom content types

