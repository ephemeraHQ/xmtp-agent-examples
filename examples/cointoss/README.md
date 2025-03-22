# CoinToss Agent

A coin toss agent built using CDP AgentKit that operates over the XMTP messaging protocol, enabling group coin toss on custom topics.

## Prerequisites

- Node.js (v20+)
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials

## Usage Examples

The agent responds to commands in group chats when tagged with `@toss`:

### Available Commands

- `@toss create <amount>` - Create a new toss with specified USDC amount
- `@toss join <tossId> <option>` - Join a toss and select your option
- `@toss close <tossId> <option>` - Close the toss and set the winning option (creator only)
- `@toss status <tossId>` - Check toss status and participants
- `@toss list` - List all active tosses
- `@toss balance` - Check your wallet balance
- `@toss <natural language toss>` - Create a toss using natural language

### Natural Language Examples

- `@toss Will it rain tomorrow for 5` - Creates a yes/no toss with 5 USDC
- `@toss Lakers vs Celtics game for 10` - Creates a toss with Lakers and Celtics as options

### Example Flow

1. **Create a toss**: `@toss Will Bitcoin hit $100k this year for 5`
2. **Join the toss**: `@toss join 1 yes` (other players must choose an option)
3. **Check status**: `@toss status 1`
4. **Close the toss**: `@toss close 1 yes` (creator decides the winning option)
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
3. The toss creator determines the winning option when closing the toss
4. Prize money is split among all players who chose the winning option
5. Transaction confirmations are provided in the chat

## Prize Distribution

- All tosses are collected in a dedicated toss wallet
- When the toss is closed, the creator chooses the winning option
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
