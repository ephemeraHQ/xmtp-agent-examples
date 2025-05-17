# LUKSO XMTP Agent

This agent connects the LUKSO blockchain with XMTP messaging, providing real blockchain data lookups, AI-powered responses, and NFT-gated group management for LUKSO users.

## Features

- Responds to LUKSO blockchain data requests via XMTP messaging
- Retrieves Universal Profile information from the LUKSO blockchain with full ERC725Y data decoding
- Gets NFT data from LUKSO accounts using LSP8 standard (both owned and issued assets)
- Shows token balances for LYX and LSP7 Digital Assets
- **Integrated AI Responses** (when API key is provided) for natural language interactions
- **Reliable Message Streaming** with automatic stream recovery
- **Transaction Support** for handling LYX transfers
- **Universal Profile Search** via on-chain data
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

# OpenAI API key for AI-powered responses (optional)
OPENAI_API_KEY= # your OpenAI API key

# Logging configuration
LOGGING_LEVEL=debug # or info, warn, error

# Network ID for transactions (optional)
NETWORK_ID=lukso-testnet # or lukso-mainnet

# Custom RPC URL (optional)
LUKSO_CUSTOM_RPC= # optional custom RPC URL
```

You can generate XMTP keys with:

```bash
yarn gen:keys
```

### Run the Agent

```bash
# Clone the repository
git clone https://github.com/your-username/xmtp-agent-examples.git

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

#### Transaction Commands

- `/balance` - Check your LYX balance
- `/tx <amount>` - Initiate a LYX transfer (requires OpenAI API key)

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
- Any natural language question - Get an AI-powered response (requires OpenAI API key)

## Known Issues

1. **Transaction History**: Due to limitations in the current ethers.js implementation, the transaction history functionality is not fully operational.

2. **GraphQL API**: The LUKSO subgraph API has been deprecated. We've updated the code to use a direct API approach, but some features might not work as expected until the new LUKSO API is fully integrated.

3. **OpenAI Integration**: The `/tx` command requires an OpenAI API key to be fully operational. If no API key is provided, the agent will display a message about disabled AI features.

4. **RPC Connectivity**: There may be occasional issues connecting to the LUKSO RPC nodes. The agent will automatically retry connections, but performance may be affected.

## How It Works

This agent combines several advanced capabilities:

1. **XMTP Client**: Handles secure messaging with automatic stream recovery
2. **Command Parser**: Extracts commands and parameters from user messages
3. **LUKSO Connection**: Connects to LUKSO blockchain via ethers.js
4. **AI Integration**: Uses OpenAI API for natural language responses (when API key is provided)
5. **Transaction Support**: Enables LYX transfers directly from the chat
6. **Response Formatter**: Formats blockchain data into human-readable messages
7. **Group Management**: Creates and manages XMTP groups with NFT-gating
8. **Group Persistence**: Stores group information in a local cache file for persistence across restarts

### Enhanced Universal Profile Support

The agent now has advanced Universal Profile data decoding capabilities:

- **ERC725Y Data Decoding**: Properly decodes complex LSP3 profile data structures
- **Multi-Key Retrieval**: Gets profile information using both combined and individual LSP3 data keys
- **Profile Links**: Extracts website, social media, and other links from profile data
- **Profile Images**: Properly handles profile image information from LSP3 data

### Advanced Token Support

The agent supports both native LYX tokens and LSP7 Digital Assets:

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

### NFT-Gated Group Management

Create and manage XMTP group conversations with advanced features:

- **Group Creation**: Create new groups with multiple Universal Profiles
- **Member Management**: Add or remove members from groups by address
- **NFT-Based Membership**: Add all holders of a specific NFT to a group
- **Group Listing**: View all active groups and their members
- **Profile Integration**: See member names and details from their Universal Profiles
- **Persistence**: Groups remain cached and accessible across agent restarts

## Upcoming Features

1. **Improved Transaction History**: We're working on integrating a better transaction history system that doesn't rely on the deprecated ethers.js methods.

2. **Direct LUKSO API Integration**: We're developing a direct integration with LUKSO's new APIs to replace the deprecated subgraph.

3. **Expanded LSP Support**: We plan to add support for more LUKSO Standard Proposals (LSPs) for a more comprehensive blockchain experience.

4. **Caching Mechanisms**: To improve performance and reduce RPC calls, we're implementing smart caching for blockchain data.

5. **Rate Limiting**: To prevent abuse, we're adding rate limiting for certain high-impact operations.

## Contributing

We welcome contributions to improve the LUKSO XMTP Agent! Please feel free to submit issues or pull requests to the repository.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Troubleshooting

### API Issues

If you encounter issues with the `/search` and `/query` commands, this may be due to changes in the LUKSO API endpoints. Some fixes to try:

1. **Update GraphQL Endpoints**: The API URLs have changed. Make sure you're using the current ones:

   ```typescript
   const LUKSO_API_MAINNET = "https://api.universalprofile.cloud/v1/mainnet/graphql";
   const LUKSO_API_TESTNET = "https://api.universalprofile.cloud/v1/testnet/graphql";
   ```

2. **Fix GraphQL Queries**: The API schema has been updated. Check the latest schema at <https://docs.lukso.tech/tools/recipes/graphql-queries/>

3. **Custom RPC URL**: If you're having RPC connectivity issues, you can set a custom RPC URL in your `.env` file:

   ```
   LUKSO_CUSTOM_RPC=https://rpc.ankr.com/lukso
   ```

### Transaction Commands

If the `/tx` command isn't working:

1. **OpenAI API Key**: Make sure you have a valid `OPENAI_API_KEY` in your `.env` file
2. **Check Wallets**: The sender must have LYX available to transfer

### XMTP Client Issues

If group management features aren't working correctly:

1. **Compatibility**: The agent is built for XMTP SDK V8+. Make sure you're using the latest version.
2. **User Discovery**: If getUsersFromIdentifiers is not working, try using the DM creation method to discover users.
3. **Group Creation**: Make sure you have the proper permissions to create and manage groups.

### TypeScript Build Issues

The agent has some known type errors that don't affect functionality:

```
index.ts(566,36): error TS2345: Argument of type 'string' is not assignable to parameter of type 'never'.
index.ts(726,19): error TS2322: Type '{ name: string; description: string; image: string; }' is not assignable to type 'null'.
index.ts(737,19): error TS2322: Type '{ name: string; description: string; image: string; }' is not assignable to type 'null'.
index.ts(759,33): error TS2339: Property 'name' does not exist on type 'never'.
index.ts(760,40): error TS2339: Property 'description' does not exist on type 'never'.
```

These are related to type issues in the NFT metadata handling and will be fixed in a future update. The agent functionality still works correctly.

To fix other TypeScript errors, ensure:

1. Set the correct TypeScript target for BigInt support:

   ```json
   "target": "ES2020"
   ```

2. Enable downlevel iteration:

   ```json
   "downlevelIteration": true
   ```

3. Create an `.env` file with all required variables before running the agent.

### RPC Connectivity

If you're experiencing connection issues with the LUKSO RPC:

1. Try a different RPC endpoint in your `.env` file
2. Ensure your internet connection is stable
3. Verify if the LUKSO network is experiencing any outages
