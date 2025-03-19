# Coinbase-Langchain

A DeFi agent built using Langchain and powered by CDP SDK, operating over the XMTP messaging protocol.

## Features

- Process blockchain payments using natural language commands
- Advanced language processing using LangChain and OpenAI
- User-specific wallet management with flexible storage options (Redis or local file)
- XMTP messaging integration for secure, decentralized chat interactions
- Powered by CDP SDK for reliable blockchain operations and Langchain for AI Agent

## Prerequisites

- Node.js (v20+)
- XMTP `node-sdk`
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials
- Yarn package manager

## Quick Start Guide

Follow these steps to get your x agent up and running:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
   cd integrations/coinbase-langchain
   ```

2. **Install dependencies**:

   ```bash
   yarn install
   ```

3. **Set up your environment variables**:
   Create a `.env` file like in `.env.example`:

   ```bash
   WALLET_KEY= # the private key for the wallet
   ENCRYPTION_KEY= # the encryption key for the wallet
   # public key is

   NETWORK_ID=base-sepolia # base-mainnet or others
   OPENAI_API_KEY= # the OpenAI API key
   CDP_API_KEY_NAME= # the name of the CDP API key
   CDP_API_KEY_PRIVATE_KEY= # the private key for the CDP API key
   XMTP_ENV=local # the environment to use for XMTP
   REDIS_URL= # the URL for the Redis database
   ```

4. **Start the agent**:

   ```bash
   yarn dev
   ```

5. **Interact with your agent**:

   Once running, you'll see a URL in the console like:

   ```bash
   Send a message on http://xmtp.chat/dm/YOUR_AGENT_ADDRESS?env=dev
   ```

   Open this URL in your browser to start chatting with your agent!

## Usage Examples

Once the agent is running, you can interact with it using natural language commands:

### Basic prompts

- "Send 0.01 USDC to 0x1234..."
- "Check my wallet balance"

## How it works

This agent combines key technologies:

1. **XMTP protocol**: Secure decentralized messaging
2. **Langchain**: AI processing and conversation management
3. **CDP SDK**: Blockchain transaction handling
4. **Storage**: Redis or local file options
5. **OpenAI**: Natural language understanding

## Troubleshooting

### Connection issues

- Verify XMTP environment settings (`local`, `dev`, or `production`)
- Check API credentials and connection strings

### Transaction issues

- Ensure sufficient wallet balance
- Verify network settings (default: base-sepolia)
- For testnets, obtain tokens from faucets

### Storage issues

- System falls back to local storage if Redis fails
- Check permissions and connection URLs
