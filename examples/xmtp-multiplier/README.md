# XMTP Multiplier Agent

A simple XMTP agent that multiplies two numbers.

## Usage

Send the agent two numbers in any of these formats:

- `5 3`
- `5, 3`
- `5 x 3`
- `multiply 5 and 3`

The agent will respond with the multiplication result.

## Setup

```bash
# Generate keys
yarn gen:keys

# Start the agent
yarn dev
```

## Environment Variables

Create a `.env` file:

```bash
XMTP_ENV=dev
XMTP_WALLET_KEY=your_private_key_here
XMTP_DB_ENCRYPTION_KEY=your_encryption_key_here
```
