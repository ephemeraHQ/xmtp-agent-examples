# XMTP Next.js App

A simple Next.js application that demonstrates how to create an ephemeral wallet and send messages to an XMTP server.

## Features

- Create an ephemeral Ethereum wallet
- Send messages to an XMTP server
- Receive "gm" responses from the server
- View message history
- Deployable to Vercel

## Prerequisites

- Node.js >= 20
- Yarn package manager

## Setup

1. Install dependencies:

```bash
yarn install
```

2. Generate XMTP keys:

```bash
yarn gen:keys
```

This will create a `.env` file with the necessary keys.

3. Start the development server:

```bash
yarn dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Deployment to Vercel

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Add the following environment variables in the Vercel dashboard:
   - `WALLET_KEY`
   - `ENCRYPTION_KEY`
   - `XMTP_ENV`

## How it works

1. The server initializes an XMTP client using the keys from the `.env` file
2. The web app creates an ephemeral Ethereum wallet when you click the "Create ephemeral wallet" button
3. When you send a message, the web app sends it to the server
4. The server creates a DM with your wallet address and sends the message
5. The server listens for messages and responds with "gm"
6. The web app displays the message history

## Architecture

- **Server**: Next.js API routes that handle XMTP client initialization and message sending
- **Client**: React components that create an ephemeral wallet and send messages to the server

## License

MIT
