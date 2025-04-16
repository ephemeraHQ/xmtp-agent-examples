# XMTP Number Multiplier Agent

This is a simple XMTP agent that:

1. Receives messages containing numbers
2. Multiplies the number by 2
3. Creates a group with the sender and an additional member
4. Sends the result in the newly created group

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Generate XMTP keys:

```bash
yarn gen:keys
```

3. Start the agent:

```bash
yarn dev
```

## Testing

You can test the agent using the test-cli tool:

```bash
# Replace with your agent's public address
yarn test-cli <AGENT_ADDRESS> "42"
```

The agent will:

1. Receive the number "42"
2. Multiply it by 2 (result: 84)
3. Create a group with your test account and 0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204
4. Send the result in that group

Try with different inputs:

- Integer numbers: "42"
- Decimal numbers: "3.14"
- Negative numbers: "-10"
- Scientific notation: "1.5e3" (1500)

Non-numeric inputs will be ignored.

## Environment Variables

The agent requires the following environment variables:

- `WALLET_KEY`: Private key for the agent's wallet
- `ENCRYPTION_KEY`: Encryption key for the local database
- `XMTP_ENV`: XMTP environment to use (local, dev, production)
