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
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials
- Yarn package manager

## Quick Start Guide

Follow these steps to get your payment agent up and running:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
   cd integrations/coinbase-langchain
   ```

2. **Install dependencies**:

   ```bash
   yarn install
   ```

3. **Generate XMTP keys**:

   ```bash
   yarn gen:keys
   ```

   This will generate random wallet and encryption keys for your agent and output them to the console. Copy these values to your `.env` file.

4. **Set up your environment variables**:
   Create a `.env` file with the following variables:

   ```
   # Required: OpenAI API Key
   OPENAI_API_KEY=your_openai_api_key_here

   # Required: Coinbase Developer Platform credentials
   CDP_API_KEY_NAME=your_cdp_api_key_name_here
   CDP_API_KEY_PRIVATE_KEY=your_cdp_api_key_private_key_here

   # Required: XMTP wallet and encryption keys (from step 3)
   WALLET_KEY=your_wallet_private_key_here
   ENCRYPTION_KEY=your_encryption_key_here
   XMTP_ENV="local" # or "dev" or "production"

   # Optional: Network ID (defaults to base-sepolia if not specified)
   NETWORK_ID=base-sepolia # or base-mainnet

   # Optional: Redis for persistent storage (if not provided, local file storage will be used)
   REDIS_URL=your_redis_url_here
   ```

5. **Start the agent**:

   ```bash
   yarn dev
   ```

6. **Interact with your agent**:
   Once running, you'll see a URL in the console like:
   ```
   Send a message on http://xmtp.chat/dm/YOUR_AGENT_ADDRESS?env=dev
   ```
   Open this URL in your browser to start chatting with your payment agent!

## Usage Examples

Once the agent is running, you can interact with it using natural language commands:

### Basic prompts

- "Send 0.01 ETH to 0x1234..."
- "Check my wallet balance"
- "Transfer 10 USDC to vitalik.eth"

## How It Works

This payment agent combines several technologies:

1. **XMTP Protocol**: For decentralized messaging and chat interface
2. **Langchain**: AI agent framework
3. **CDP SDK**: Blockchain Operations
4. **Storage Options**: Redis or local file storage for wallet data
5. **LLM Integration**: For natural language processing

The payment agent integrates several key technologies:

1. **XMTP Protocol**: Provides decentralized messaging infrastructure
2. **LangChain**: Powers natural language processing and conversation flow
3. **Coinbase AgentKit**: Handles blockchain interactions and wallet management
4. **Storage Layer**: Flexible storage with Redis or local file system
5. **OpenAI Integration**: Advanced language understanding and response generation

### Key Components

- `src/index.ts`: Main application entry point
- `src/cdp.ts`: Coinbase Developer Platform integration
- `src/xmtp.ts`: XMTP messaging protocol implementation
- `src/langchain.ts`: LangChain agent and processing logic
- `src/storage.ts`: Data persistence layer

## Troubleshooting

Common issues and solutions:

### Connection Issues

- Verify XMTP environment settings match your needs (`local`, `dev`, or `production`)
- Check Redis connection string if using Redis storage
- Ensure CDP API credentials are correctly formatted
- Verify OpenAI API key has sufficient quota

### Transaction Issues

- Confirm wallet has sufficient balance for transactions
- Check network settings match your intended network
- Verify gas price settings for your chosen network
- For testnets, ensure you've obtained test tokens from a faucet

### Storage Issues

- If Redis connection fails, the system will automatically fall back to local storage
- Check file permissions if using local storage
- Verify Redis URL format if using Redis

### Transaction Failures

- Check that you're on the correct network (default is base-sepolia)
- Ensure the wallet has sufficient funds for the transaction
- For testnet operations, request funds from a faucet
