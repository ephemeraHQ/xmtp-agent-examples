# Coinbase-Langchain

A DeFi agent built using Langchain and powered by CDP SDK, operating over the XMTP messaging protocol.

## Features

- Process blockchain payments using natural language commands
- Advanced language processing using LangChain and OpenAI
- User-specific wallet management with flexible storage options (Redis or local file)
- XMTP messaging for secure, decentralized chat interactions
- Powered by CDP SDK for reliable blockchain operations and Langchain for AI Agent

## Prerequisites

- Node.js (v20+)
- XMTP `node-sdk`
- [OpenAI](https://platform.openai.com/) API key
- [Coinbase Developer Platform](https://portal.cdp.coinbase.com) (CDP) API credentials
- Yarn package manager

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

## Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/coinbase-langchain
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
