# Payment Agent

A DeFi payment agent built using CDP AgentKit that operates over the XMTP messaging protocol.

## Features

- Process payments on the blockchain using natural language commands
- User-specific wallet management with flexible storage options (Redis or local file)
- XMTP messaging integration for chat-based interactions
- Powered by Coinbase AgentKit for blockchain operations

## Prerequisites

- Node.js (v20+)
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials

## Quick Start Guide

Follow these steps to get your payment agent up and running quickly:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/raihankhan-rk/xmpt-cdp-quickstart.git
   cd examples/paymentagent
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

   # Optional: Network ID (defaults to base-sepolia if not specified)
   NETWORK_ID=base-sepolia

   # Optional: Redis for persistent storage (if not provided, local file storage will be used)
   REDIS_URL=redis://localhost:6379
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
2. **Coinbase AgentKit**: AI agent framework
3. **Storage Options**: Redis or local file storage for wallet data
4. **LLM Integration**: For natural language processing

For each user who interacts with the agent:

1. A unique CDP MPC wallet is created and stored
2. Natural language prompts are processed
3. Onchain transactions are executed
4. Transaction status is communicated back to the user

## Troubleshooting

Common issues and solutions:

### Connection Issues

- If Redis connection fails, the agent will automatically fall back to local file storage
- Ensure your CDP API credentials are correct
- Verify your OpenAI API key is valid

### Transaction Failures

- Check that you're on the correct network (default is base-sepolia)
- Ensure the wallet has sufficient funds for the transaction
- For testnet operations, request funds from a faucet
