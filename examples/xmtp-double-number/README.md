# XMTP Double Number Agent

A simple XMTP agent that receives a number and returns its 2x multiple.

## How it works

Send any number to this agent and it will respond with the number multiplied by 2.

## Examples

- Send `5` → Receive `✅ 5 × 2 = 10`
- Send `3.14` → Receive `✅ 3.14 × 2 = 6.28`
- Send `hello` → Receive `❌ That's not a valid number! Please send me a number and I'll double it for you.`

## Run

```bash
cd examples/xmtp-double-number
yarn dev
```

Make sure you have a `.env` file with your XMTP keys:

```bash
WALLET_KEY=your_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
XMTP_ENV=dev
```

Generate keys with `yarn gen:keys` if needed.
