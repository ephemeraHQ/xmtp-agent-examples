# XMTP Number Multiplier Agent

This is a simple XMTP agent that:

1. Listens for incoming messages containing numbers
2. Multiplies each number by 2
3. Creates a new group with the sender and a specified address
4. Sends the result to the new group

## Setup

### Clone the repository

```bash
git clone https://github.com/xmtp/xmtp-agent-examples.git
cd xmtp-agent-examples
```

### Install dependencies

```bash
yarn install
```

### Generate keys

```bash
cd examples/xmtp-number-multiplier
yarn gen:keys
```

This will generate a `.env` file with:

- A wallet private key
- An encryption key
- The public key associated with your agent

## Running the agent

```bash
# Start the agent
yarn dev
```

## Testing the agent

Send a message to your agent with a number:

```bash
# From the project root directory
yarn test-cli YOUR_AGENT_PUBLIC_KEY "42"
```

Replace `YOUR_AGENT_PUBLIC_KEY` with the public key that was generated in your `.env` file.

The agent will:

1. Receive your message
2. Parse the number (42)
3. Multiply it by 2 (84)
4. Create a new group with you and `0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204`
5. Send the result in that group
6. Send a confirmation message back to you directly
