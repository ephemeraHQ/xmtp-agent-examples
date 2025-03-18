# CoinToss Agent

A decentralized toss agent built using CDP AgentKit that operates over the XMTP messaging protocol, enabling group toss on custom topics.

## Features

- XMTP group chat support (responds to @toss mentions)
- Natural language bet creation (e.g., "Will it rain tomorrow for 10 USDC")
- Support for custom betting topics and options
- Multiple player support with option-based prize distribution
- Wallet address display for transparency and accountability
- Transaction hash links for payment verification
- Automated prize distribution to all winners
- Real-time messaging through XMTP

## Prerequisites

- Node.js (v20+)
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials

## Quick Start Guide

Follow these steps to get your CoinToss agent up and running quickly:

1. **Clone the repository**:

   ```bash
   git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
   cd integrations/cointoss
   ```

2. **Install dependencies**:

   ```bash
   yarn install
   ```

3. **Generate XMTP keys**:

   ```bash
   yarn build
   yarn gen:keys
   ```

   This will generate random wallet and encryption keys for your agent and output them to the console. Copy these values to your `.env` file.


4. **Set up your environment variables**:
   Create a `.env` file with the following variables:

   ```
   # Required: OpenAI API Key
   OPENAI_API_KEY=your_openai_api_key_here

   # Required: Coinbase Developer Platform credentials 
   CDP_KEY_NAME=your_api_key_name_here
   CDP_API_KEY_PRIVATE_KEY=your_api_key_private_key_here

   # Required: XMTP wallet and encryption keys (from step 3)
   WALLET_KEY=your_wallet_private_key_here
   ENCRYPTION_KEY=your_encryption_key_here

   # Optional: Network ID (defaults to base-sepolia if not specified)
   NETWORK_ID=base-sepolia

   # Optional: Redis for persistent storage (if not provided, local file storage will be used)
   REDIS_URL=redis://localhost:6379
   ```

5. **Build and start the agent**:

   ```bash
   yarn build
   yarn start
   ```

   For development with more detailed logs:
   ```bash
   yarn dev
   ```

6. **Invite the agent to your XMTP group chat**:
   The agent responds when tagged with `@toss` in a group chat.

## Usage Examples

The agent responds to commands in group chats when tagged with `@toss`:

### Available Commands

- `@toss create <amount>` - Create a new betting game with specified USDC amount
- `@toss join <gameId> <option>` - Join a game and select your option
- `@toss execute <gameId>` - Execute the bet resolution (creator only)
- `@toss status <gameId>` - Check game status and participants
- `@toss list` - List all active games
- `@toss balance` - Check your wallet balance
- `@toss <natural language bet>` - Create a bet using natural language

### Natural Language Examples
- `@toss Will it rain tomorrow for 5` - Creates a yes/no bet with 5 USDC
- `@toss Lakers vs Celtics game for 10` - Creates a bet with Lakers and Celtics as options

### Example Flow

1. **Create a game**: `@toss Will Bitcoin hit $100k this year for 5`
2. **Join the game**: `@toss join 1 yes` (each player must choose an option)
3. **Check status**: `@toss status 1`
4. **Execute the bet**: `@toss execute 1` (creator only)
5. **View results**: All players who chose the winning option share the prize pool

## How It Works

This CoinToss agent combines several technologies:

1. **XMTP Protocol**: For group chat messaging interface
2. **Coinbase AgentKit**: For wallet management and payments
3. **Storage Options**: Redis or local file storage for game and wallet data
4. **LLM Integration**: For natural language bet parsing

The agent workflow:
1. Users create or join betting games in group chats
2. Each player is assigned a unique wallet 
3. The game creator determines when to execute the bet
4. A random option is selected as the winner
5. Prize money is split among all players who chose the winning option

## Prize Distribution

- All bets are collected in a dedicated game wallet
- When the game is executed, a winning option is randomly selected
- All players who chose the winning option share the prize pool equally
- Automatic transfers are sent to each winner's wallet
- Transaction confirmations are provided in the chat

## Troubleshooting

### Wallet Creation Errors

If you see errors like `Failed to create wallet: APIError`:

1. **Coinbase API Keys**: 
   - Verify your API key name matches exactly as shown in the Coinbase Developer Dashboard
   - Ensure your private key includes the complete PEM format with BEGIN/END lines
   - Format multiline keys properly for your .env file

2. **Network Issues**:
   - Check your internet connectivity and API endpoint access
   - Verify there are no Coinbase service outages

If you're still encountering issues, try clearing your local wallet data:
```bash
rm -rf .data/wallets
```

## Architecture

- **Wallet Management**: Coinbase SDK for wallet creation and transfers
- **XMTP Integration**: Group chat support with @toss tag handling
- **Unified Agent System**: 
  - Single AI agent for both natural language parsing and wallet operations
- **Game Logic**: 
  - Random selection of winning option
  - Fair prize distribution among winners
- **Storage Options**: Local file storage or Redis

## Security

- Each user and game gets a dedicated Coinbase wallet
- Encrypted wallet storage
- Transparent wallet address display
- Transaction verification through block explorer links
- Advanced randomness for fair winner selection

## License

MIT

## Code Structure

The CoinToss agent codebase is organized with a modular design:

- **src/index.ts**: Main entry point that initializes the system and handles XMTP message routing
- **src/commands.ts**: Command processor that handles all explicit commands and natural language bets
- **src/cdp.ts**: Agent for natural language processing and wallet operations
- **src/game.ts**: Game logic implementation
- **src/storage.ts**: Storage layer for persisting games and wallet data
- **src/walletService.ts**: Wallet functions for creating and managing game wallets
- **src/xmtp.ts**: XMTP integration for messaging
- **src/types.ts**: Type definitions