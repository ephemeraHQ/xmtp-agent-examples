# CoinToss Agent

A decentralized toss agent built using CDP AgentKit that operates over the XMTP messaging protocol, enabling group toss on custom topics.

## Features

- XMTP group chat support (responds to @toss mentions)
- Natural language toss creation (e.g., "Will it rain tomorrow for 10 USDC")
- Support for custom toss topics and options
- Multiple player support with option-based prize distribution
- Wallet address display for transparency and accountability
- Transaction hash links for payment verification
- Automated prize distribution to all winners
- Real-time messaging through XMTP

## Prerequisites

- Node.js (v20+)
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials

## Usage Examples

The agent responds to commands in group chats when tagged with `@toss`:

### Available Commands

- `@toss create <amount>` - Create a new toss with specified USDC amount
- `@toss join <tossId> <option>` - Join a toss and select your option
- `@toss execute <tossId>` - Execute the toss resolution (creator only)
- `@toss status <tossId>` - Check toss status and participants
- `@toss list` - List all active tosses
- `@toss balance` - Check your wallet balance
- `@toss <natural language toss>` - Create a toss using natural language

### Natural Language Examples

- `@toss Will it rain tomorrow for 5` - Creates a yes/no toss with 5 USDC
- `@toss Lakers vs Celtics game for 10` - Creates a toss with Lakers and Celtics as options

### Example Flow

1. **Create a toss**: `@toss Will Bitcoin hit $100k this year for 5`
2. **Join the toss**: `@toss join 1 yes` (each player must choose an option)
3. **Check status**: `@toss status 1`
4. **Execute the toss**: `@toss execute 1` (creator only)
5. **View results**: All players who chose the winning option share the prize pool

## How It Works

This CoinToss agent combines several technologies:

1. **XMTP Protocol**: For group chat messaging interface
2. **Coinbase AgentKit**: For wallet management and payments
3. **Storage Options**: Local storage for toss and wallet data
4. **LLM Integration**: For natural language toss parsing

The agent workflow:

1. Users create or join tosses in group chats
2. Each player is assigned a unique wallet
3. The toss creator determines when to execute the toss
4. A random option is selected as the winner
5. Prize money is split among all players who chose the winning option

## Prize Distribution

- All tosses are collected in a dedicated toss wallet
- When the toss is executed, a winning option is randomly selected
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
- **Toss Logic**:
  - Random selection of winning option
  - Fair prize distribution among winners

## Security

- Each user and toss gets a dedicated Coinbase wallet
- Encrypted wallet storage
- Transparent wallet address display
- Transaction verification through block explorer links
- Advanced randomness for fair winner selection

## Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/cointoss
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
