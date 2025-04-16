# Number multiplier XMTP agent

A simple XMTP agent that:

1. Listens for incoming numeric messages
2. Multiplies the number by 2
3. Creates a new group with the sender and a predefined address
4. Sends the result and member information to the group

## Setup

1. Clone the repository and navigate to this example:

```bash
cd examples/xmtp-number-multiplier
```

2. Generate keys for the agent:

```bash
yarn gen:keys
```

3. Run the agent:

```bash
yarn dev
```

## Testing

Use the test-cli tool to interact with your agent:

```bash
yarn test-cli
```

The test CLI will prompt you to:

1. Enter the agent's address (displayed in the console when running the agent)
2. Send a message to the agent

## Expected behavior

1. When you send a numeric message (e.g., "42"), the agent will:

   - Parse the number from your message
   - Multiply it by 2
   - Create a new group with you and the address 0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204
   - Send the calculation result to the group
   - Send member details (inbox ID, address, installation ID) to the group

2. If you send a non-numeric message, the agent will ignore it.
