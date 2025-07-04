# XMTP Inline Actions Example

A simple XMTP agent that demonstrates inline actions by sending polls and handling user responses.

## What it does

This agent creates interactive polls using inline actions and logs user responses. When someone sends a message containing "poll" or "vote", it responds with a food poll that users can interact with using inline action buttons.

## Features

- 🗳️ **Interactive Polls**: Sends polls with multiple choice options as inline actions
- 📊 **Response Logging**: Logs detailed information about user selections
- 🔄 **Intent Handling**: Processes intent messages when users interact with actions
- ✅ **Confirmation**: Sends confirmation messages when votes are received

## How it works

1. **Trigger**: Send a message containing "poll" or "vote"
2. **Poll Display**: Agent responds with a food preference poll
3. **User Interaction**: Users click on action buttons to select their choice
4. **Response Handling**: Agent receives intent messages and logs the selections
5. **Confirmation**: Agent sends a thank you message confirming the choice

## Content Types Handled

- **Actions**: `coinbase.com/actions` - Sends interactive poll options
- **Intents**: `coinbase.com/intent` - Receives user selections
- **Text**: `xmtp.org/text` - Triggers polls and sends confirmations

## Example Flow

```
User: "Create a poll"
Agent: "🗳️ Food Poll - What's your favorite food?
        [1] 🍕 Pizza
        [2] 🍔 Burgers  
        [3] 🌮 Tacos
        [4] 🍣 Sushi"

User: [Clicks Pizza button]
Agent: "Thanks for voting! You selected: 🍕 Pizza"

Console Output:
🗳️ POLL RESPONSE RECEIVED
📍 Conversation: 2cd451b8676a27d83b5dad7b9946b53f
👤 Sender: d6ea032810c6ff6993392af50d4bd57d25f51f05b075099f7473982931388990
📝 Fallback: "User selected action: pizza"
✅ Selected Option: pizza (🍕 Pizza)

📊 VOTE LOGGED:
   Time: 2024-01-15T10:30:45.123Z
   Voter: d6ea032810c6ff6993392af50d4bd57d25f51f05b075099f7473982931388990
   Choice: pizza (🍕 Pizza)
```

## Setup

1. Generate your keys:
   ```bash
   yarn gen:keys
   ```

2. Run the agent:
   ```bash
   yarn dev
   ```

3. Send a message containing "poll" or "vote" to trigger the example

## Environment Variables

Create a `.env` file with:

```bash
WALLET_KEY=your_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
XMTP_ENV=dev
```

## Note

This example demonstrates the concept of inline actions. The actual implementation of sending actions content types may require additional content codecs or specific client support depending on your XMTP client configuration.