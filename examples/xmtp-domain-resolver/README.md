# Domain Resolver Agent

An XMTP agent that performs reverse resolution of Ethereum addresses to Web3 identities using the [Web3.bio API](https://api.web3.bio/).

## Features

- **Reverse Resolution**: Resolves Ethereum addresses to domain names across multiple platforms
- **Multi-Platform Support**: Finds identities from ENS, Farcaster, Lens, Basenames, Linea Name Service, and more
- **Automatic Detection**: Uses sender's address if no address is provided in the message

## How It Works

Send an Ethereum address and the agent will look up associated domain names across various Web3 platforms:

- **ENS** (e.g., `vitalik.eth`)
- **Farcaster** (e.g., `dwr.eth`)
- **Lens Protocol** (e.g., `stani.lens`)
- **Basenames** (e.g., `tony.base.eth`)
- **Linea Name Service** (e.g., `name.linea.eth`)

## Setup

```bash
# Generate keys
yarn gen:keys

# Add Web3.bio API key to .env (optional but recommended for rate limits)
WEB3_BIO_API_KEY=your_api_key_here
```

## Usage

Start the agent:

```bash
yarn dev
```

Send an Ethereum address to resolve:

```
0xd8da6bf26964af9d7eed9e03e53415d37aa96045
```

Response:

```
Address: 0xd8da6bf26964af9d7eed9e03e53415d37aa96045

Resolved names:
vitalik.eth (ens)
vitalik.eth (farcaster)
vitalik.lens (lens)
```

## API Reference

This agent uses the Web3.bio `/ns/` endpoint for identity resolution. For more details, see the [Web3.bio API documentation](https://api.web3.bio/).
