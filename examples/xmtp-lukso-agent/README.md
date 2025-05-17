# LUKSO XMTP Agent

This agent connects the LUKSO blockchain with XMTP messaging, providing real blockchain data lookups, AI-powered responses, and NFT-gated group management for LUKSO users.

## Features

- Responds to LUKSO blockchain data requests via XMTP messaging
- Retrieves Universal Profile information from the LUKSO blockchain with full ERC725Y data decoding
- Gets NFT data from LUKSO accounts using LSP8 standard (both owned and issued assets)
- Shows token balances for LYX and LSP7 Digital Assets
- Provides transaction history for addresses
- Connects directly to LUKSO blockchain via RPC
- **Integrated AI Responses** using OpenAI API for natural language interactions
- **Reliable Message Streaming** with automatic stream recovery
- **Transaction Support** for handling LYX transfers
- **Universal Profile Search** via LUKSO's subgraph
- **NFT-Gated Group Management** for creating and managing groups with NFT holders

## Getting Started

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher

### Environment Variables

To run this XMTP agent, create a `.env` file with the following variables:

```bash
# XMTP configuration
WALLET_KEY= # private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production

# OpenAI API key for AI-powered responses
OPENAI_API_KEY= # your OpenAI API key

# Logging configuration
LOGGING_LEVEL=debug # or info, warn, error

# Network ID for transactions (optional)
NETWORK_ID=lukso-testnet # or lukso-mainnet
```

You can generate XMTP keys with:

```bash
yarn gen:keys
```

### Run the Agent

```bash
# Clone the repository
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git

# Navigate to the example directory
cd xmtp-agent-examples/examples/xmtp-lukso-agent

# Install dependencies
yarn install

# Generate XMTP keys
yarn gen:keys

# Start the agent
yarn dev
```

## Usage

Once the agent is running, you can send messages to it using any XMTP-compatible client (like [xmtp.chat](https://xmtp.chat)).

### Available Commands

#### LUKSO Blockchain Commands

- `profile <address>` - Get LUKSO Universal Profile information
- `nfts <address>` - List LSP8 NFTs owned by or issued by an address
- `tokens <address>` - List tokens owned by an address (LYX and LSP7 tokens)
- `transactions <address>` - Recent transactions for an address

#### Transaction Commands

- `/balance` - Check your LYX balance
- `/tx <amount>` - Initiate a LYX transfer

#### Search & User Commands

- `/search <term>` - Search for Universal Profiles by name
- `/query <address>` - Get detailed info about a Universal Profile

#### Group Management Commands

- `/creategroup <name> <address1> [address2...]` - Create a new group
- `/addtogroup <groupId> <address>` - Add a member to a group
- `/nftaddtogroup <groupId> <nftAddress>` - Add NFT holders to a group
- `/listgroups` - List all active groups
- `/listmembers <groupId>` - List members in a group
- `/removefromgroup <groupId> <address>` - Remove a member from a group

#### Help

- `help` or `/help` - Show available commands
- Any natural language question - Get an AI-powered response

## How It Works

This agent combines several advanced capabilities:

1. **XMTP Client**: Handles secure messaging with automatic stream recovery
2. **Command Parser**: Extracts commands and parameters from user messages
3. **LUKSO Connection**: Connects to LUKSO blockchain via ethers.js
4. **AI Integration**: Uses OpenAI API for natural language responses
5. **Transaction Support**: Enables LYX transfers directly from the chat
6. **Response Formatter**: Formats blockchain data into human-readable messages
7. **SubGraph Integration**: Connects to LUKSO's subgraph for additional data
8. **Group Management**: Creates and manages XMTP groups with NFT-gating

### Enhanced Universal Profile Support

The agent now has advanced Universal Profile data decoding capabilities:

- **ERC725Y Data Decoding**: Properly decodes complex LSP3 profile data structures
- **Multi-Key Retrieval**: Gets profile information using both combined and individual LSP3 data keys
- **Profile Links**: Extracts website, social media, and other links from profile data
- **Profile Images**: Properly handles profile image information from LSP3 data

### Advanced Token Support

The agent now supports both native LYX tokens and LSP7 Digital Assets:

- **LSP7 Standard**: Uses LUKSO's LSP7 Digital Asset standard for fungible tokens
- **Dual Asset Discovery**: Checks LSP5 Received Assets for owned tokens
- **Metadata Retrieval**: Gets token names, symbols, and decimals for proper formatting
- **Balance Formatting**: Correctly formats token balances based on token decimal places

### NFT Integration

The agent supports full LUKSO NFT discovery and retrieval:

- **LSP8 Standard**: Uses LUKSO's LSP8 Identifiable Digital Asset standard for NFTs
- **Dual Asset Discovery**: Checks both LSP12 Issued Assets and LSP5 Received Assets
- **Metadata Retrieval**: Gets token names, symbols, and URIs directly from contracts
- **IPFS Support**: Formats IPFS URIs for HTTP gateway access
- **Collection Information**: Provides collection details along with individual NFTs
- **Smart Pagination**: Limits results to prevent excessive blockchain queries

### Universal Profile Search

The agent integrates with LUKSO's subgraph for enhanced Universal Profile discovery:

- **Name Search**: Finds profiles by name using the LUKSO subgraph
- **Detailed Information**: Retrieves comprehensive profile metadata
- **Asset Counts**: Shows owned and issued asset counts for profiles
- **Creation Time**: Displays when profiles were created

### NFT-Gated Group Management

Create and manage XMTP group conversations with advanced features:

- **Group Creation**: Create new groups with multiple Universal Profiles
- **Member Management**: Add or remove members from groups by address
- **NFT-Based Membership**: Add all holders of a specific NFT to a group
- **Group Listing**: View all active groups and their members
- **Profile Integration**: See member names and details from their Universal Profiles
- **Persistence**: Groups remain cached and accessible across agent restarts

### Implementation Notes

The agent connects to the LUKSO mainnet subgraph and uses OpenAI's GPT model for AI-powered responses. For production use, you would want to:

1. Add caching mechanisms for better performance
2. Implement additional error handling and rate limiting
3. Add support for more LUKSO-specific data like other LSPs (LUKSO Standard Proposals)
4. Use a production-ready OpenAI API key with appropriate usage limits
5. Add authentication for group management features
