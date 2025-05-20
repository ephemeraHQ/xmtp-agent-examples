import { Client, type LogLevel, type XmtpEnv, Group, IdentifierKind } from "@xmtp/node-sdk";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
} from "@xmtp/content-type-wallet-send-calls";
import { ethers } from "ethers";
import OpenAI from "openai";
import { GraphQLClient, gql } from 'graphql-request';
import fetch from 'cross-fetch';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Check critical environment variables and provide feedback
const WALLET_KEY = process.env.WALLET_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const XMTP_ENV = process.env.XMTP_ENV || 'dev';

// Validate critical environment variables
if (!WALLET_KEY) {
  console.error("❌ ERROR: WALLET_KEY environment variable is not set");
  console.error("Please create a .env file with WALLET_KEY or set it in your environment");
  console.error("You can generate keys using: yarn gen:keys");
  process.exit(1);
}

if (!ENCRYPTION_KEY) {
  console.error("❌ ERROR: ENCRYPTION_KEY environment variable is not set");
  console.error("Please create a .env file with ENCRYPTION_KEY or set it in your environment");
  console.error("You can generate keys using: yarn gen:keys");
  process.exit(1);
}

// Get other environment variables (with defaults)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const LOGGING_LEVEL = process.env.LOGGING_LEVEL || 'info';
const NETWORK_ID = process.env.NETWORK_ID || 'lukso-testnet';
const LUKSO_CUSTOM_RPC = process.env.LUKSO_CUSTOM_RPC || '';

// Helper functions (local implementation to avoid import issues)
function createSigner(key: string): any {
  try {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid private key: key is undefined or not a string');
    }
    
    // Try to fix common key format issues
    const normalizedKey = key.trim();
    // Make sure it has 0x prefix
    const keyWithPrefix = normalizedKey.startsWith('0x') ? normalizedKey : `0x${normalizedKey}`;
    
    // Validate key length
    if (keyWithPrefix.length !== 66) {  // 0x + 64 hex chars
      console.warn(`Warning: Private key has unusual length ${keyWithPrefix.length} (expected 66 chars including 0x prefix)`);
    }
    
    console.log(`Creating wallet with key length: ${keyWithPrefix.length}`);
    
    // Create the wallet with the normalized key
    const account = new ethers.Wallet(keyWithPrefix);
    console.log(`Successfully created wallet with address: ${account.address}`);
    
    return {
      type: "EOA",
      getIdentifier: () => ({
        identifierKind: IdentifierKind.Ethereum,
        identifier: account.address.toLowerCase(),
      }),
      signMessage: async (message: string) => {
        const signature = await account.signMessage(message);
        return ethers.getBytes(signature);
      },
    };
  } catch (error) {
    console.error("Error creating signer:", error);
    throw new Error(`Failed to create signer: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getEncryptionKeyFromHex(hex: string): Uint8Array {
  try {
    // Normalize the hex string
    const cleaned = hex.trim().startsWith('0x') ? hex.trim().slice(2) : hex.trim();
    
    // Check if the length is valid (should be 64 characters for 32 bytes)
    if (cleaned.length !== 64) {
      console.warn(`Warning: Encryption key has unusual length ${cleaned.length} (expected 64 hex chars)`);
    }
    
    // Convert hex to bytes
    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
      // Parse each pair of hex chars into a byte
      const byte = parseInt(cleaned.slice(i, i + 2), 16);
      if (isNaN(byte)) {
        throw new Error(`Invalid hex character at position ${i}`);
      }
      bytes[i / 2] = byte;
    }
    
    console.log(`Created encryption key with ${bytes.length} bytes`);
    return bytes;
  } catch (error) {
    console.error("Error parsing encryption key:", error);
    throw new Error(`Failed to parse encryption key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateEnvironment(required: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of required) {
    const value = process.env[key];
    if (!value) {
      console.warn(`Missing required env var ${key}`);
    }
    result[key] = value || '';
  }
  return process.env as Record<string, string>;
}

function logAgentDetails(client: Client): void {
  console.log(`
=======================
🤖 LUKSO XMTP Agent 🤖
=======================
Inbox ID: ${client.inboxId}
Installation ID: ${client.installationId}
=======================
`);
}

function getDbPath(env: string): string {
  const timestamp = Date.now().toString();
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? '.data/xmtp';
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  const uniquePath = `${volumePath}/${env}-lukso-${timestamp}.db3`;
  console.log(`Creating new database at: ${uniquePath}`);
  return uniquePath;
}

// Initialize OpenAI client if API key is provided
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// LUKSO blockchain constants
const LUKSO_RPC_MAINNET = "https://rpc.lukso.gateway.fm";
const LUKSO_RPC_TESTNET = "https://rpc.testnet.lukso.gateway.fm";

// Allow a custom RPC to be provided via env variable
const LUKSO_RPC = LUKSO_CUSTOM_RPC || 
  (NETWORK_ID === "lukso-mainnet" ? LUKSO_RPC_MAINNET : LUKSO_RPC_TESTNET);

// Initialize JSON-RPC provider
let provider: ethers.JsonRpcProvider;
try {
  provider = new ethers.JsonRpcProvider(LUKSO_RPC);
  console.log(`Connected to LUKSO RPC at ${LUKSO_RPC}`);
} catch (error) {
  console.error(`Failed to connect to LUKSO RPC at ${LUKSO_RPC}:`, error);
  // Create a fallback provider that will retry connections
  provider = new ethers.JsonRpcProvider(LUKSO_RPC);
}

// ERC725Y interface for Universal Profiles
const erc725yAbi = [
  "function getData(bytes32[] keys) view returns (bytes[])",
  "function getDataBatch(bytes32[] keys) view returns (bytes[])"
];

// LSP4 interface for digital assets metadata
const lsp4Abi = [
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function tokenURI() view returns (string)"
];

// LSP7 interface for digital assets (LUKSO's token standard)
const lsp7Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function getData(bytes32[]) view returns (bytes[])",
  "function getDataBatch(bytes32[]) view returns (bytes[])"
];

// LSP8 interface for NFTs (LUKSO's NFT standard)
const lsp8Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function tokenIdsOf(address) view returns (bytes32[])",
  "function tokenOwnerOf(bytes32) view returns (address)",
  "function tokenURI(bytes32) view returns (string)",
  "function getData(bytes32[]) view returns (bytes[])",
  "function getDataBatch(bytes32[]) view returns (bytes[])",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

// Transaction interface
const transactionAbi = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event TransferValue(address indexed from, address indexed to, uint256 value)"
];

// LSP keys for profile data
const LSP3_PROFILE_KEY = "0x5ef83ad9559033e6e941db7d7c495acdce616347d28e90c7ce47cbfcfcad3bc5";
const LSP12_ISSUED_ASSETS_KEY = "0x7c8c3416d6cda87cd42c71ea1843df28ac4850354f988d55ee2eaa47b6dc05cd";
const LSP5_RECEIVED_ASSETS_KEY = "0x6460ee3c0aac563ccbf76d6e1d07bada78e3a9514e6382b736ed3f478ab7b90b";
const LSP5_RECEIVED_ASSETS_MAP_PREFIX = "0x6460ee3c0aac563ccbf76d6e1d07bada78e3a9514e6382b736ed3f478ab7b90b";

// LSP3 Profile specific keys
const LSP3_NAME_KEY = "0xa5f15b1fa920bbdbc28f5d785e5224e3a66eb5f7d4092dc9ba82d5e5ae3abc87";
const LSP3_DESCRIPTION_KEY = "0xd4c77bce1f500afd42b8327e7e1f451c460c619f40ab7e7b3c8f32ab6789aee5";
const LSP3_PROFILE_IMAGE_KEY = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036c81580521a843ade4307a";
const LSP3_LINKS_KEY = "0xce6282c783586e5d6a0c5c59c20d290ce7d1e33219ebbb603fe18b3de9da4648";

// Stream recovery configuration
const MAX_RETRIES = 6; // Maximum retry attempts
const RETRY_DELAY_MS = 10000; // 10 seconds between retries

// Define the groups cache file path
const DATA_DIR = ".data";
const GROUPS_CACHE_FILE = path.join(DATA_DIR, "groups-cache.json");

// Type for groups cache data
interface GroupCacheEntry {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  memberCount: number;
}

// Make sure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper function to pause execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Track active groups created by the agent
const activeGroups: Map<string, Group> = new Map();

// Simple USDC handler for Base network (simplified implementation)
class LYXHandler {
  private networkId: string;

  constructor(networkId: string) {
    this.networkId = networkId;
  }

  async getLYXBalance(address: string): Promise<string> {
    try {
      // Get LYX balance using the provider
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Error fetching LYX balance:", error);
      return "0.00";
    }
  }

  createLYXTransferCalls(
    fromAddress: string,
    recipientAddress: string,
    amount: number
  ) {
    // Implementation for LYX transfer (native token)
    const amountInWei = ethers.parseEther(amount.toString()).toString();
    
    // Convert addresses to proper format with 0x prefix
    const from = fromAddress.startsWith('0x') ? fromAddress : `0x${fromAddress}`;
    const to = recipientAddress.startsWith('0x') ? recipientAddress : `0x${recipientAddress}`;
    
    // Get chain ID in hex format (0x42 for testnet, 0x2A for mainnet)
    const chainId = this.networkId === "lukso-mainnet" ? "0x2A" : "0x42";
    
    return {
      version: "1.0",
      from: from as `0x${string}`,
      chainId: chainId as `0x${string}`,
      calls: [
        {
          to: to as `0x${string}`,
          value: amountInWei,
          data: "0x" as `0x${string}`, // Empty data for native transfers
          metadata: {
            description: `Transfer ${amount} LYX on LUKSO ${this.networkId === "lukso-mainnet" ? "Mainnet" : "Testnet"}`,
            transactionType: "transfer",
            currency: "LYX",
            amount: amountInWei,
            decimals: 18,
            networkId: this.networkId,
          },
        },
      ],
    };
  }
}

// Helper function to decode issued/received assets array
function decodeAssetsArray(data: string): string[] {
  if (!data || data === "0x") {
    return [];
  }
  
  try {
    // Remove 0x prefix and get data length
    const hexData = data.slice(2);
    
    // The first 32 bytes (64 chars) contain the array length
    const arrayLength = parseInt(hexData.slice(0, 64), 16);
    
    // Extract asset addresses
    const addresses: string[] = [];
    for (let i = 0; i < arrayLength; i++) {
      // Each address is 20 bytes (40 chars), starting after the length field
      // with proper padding for each array element (32 bytes total per element)
      const startPos = 64 + (i * 64);
      // Extract 20 bytes for the address, ignoring padding
      const addressHex = hexData.slice(startPos + 24, startPos + 64);
      addresses.push(`0x${addressHex}`);
    }
    
    return addresses;
  } catch (error) {
    console.error("Error decoding assets array:", error);
    return [];
  }
}

/**
 * Helper function to decode hex string to UTF-8 text
 */
function decodeHexToText(hex: string): string {
  try {
    if (!hex || hex === "0x") return "";
    
    // Remove 0x prefix
    const hexString = hex.startsWith("0x") ? hex.slice(2) : hex;
    
    // Convert hex to bytes
    const bytes = new Uint8Array(hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Convert bytes to string
    return new TextDecoder().decode(bytes);
  } catch (error) {
    console.error("Error decoding hex to text:", error);
    return "";
  }
}

/**
 * Helper function to decode LSP3 Profile JSON data
 */
function decodeLSP3ProfileData(data: string): any {
  try {
    if (!data || data === "0x") return null;
    
    // The first bytes contain the ERC725Y data type and the length
    // For string data, we need to extract the actual string content
    
    // Remove 0x prefix
    const hexData = data.slice(2);
    
    // Check for bytes32 data type (0x01)
    if (hexData.startsWith("01")) {
      return decodeHexToText(data.slice(4)); // Skip type identifier
    }
    
    // Check for bytes data type (0x02)
    if (hexData.startsWith("02")) {
      // The next 32 bytes (64 hex chars) contain the length
      const lengthHex = hexData.slice(2, 66);
      const length = parseInt(lengthHex, 16);
      
      // The actual data starts after the length field
      const actualData = "0x" + hexData.slice(66, 66 + length * 2);
      
      // Try to parse as JSON if it looks like JSON
      const textData = decodeHexToText(actualData);
      if (textData.startsWith("{") || textData.startsWith("[")) {
        try {
          return JSON.parse(textData);
        } catch {
          return textData;
        }
      }
      
      return textData;
    }
    
    return null;
  } catch (error) {
    console.error("Error decoding LSP3 data:", error);
    return null;
  }
}

/**
 * Get LUKSO profile information
 */
async function getProfileData(address: string): Promise<any> {
  try {
    // Create contract instance for the Universal Profile
    const profileContract = new ethers.Contract(address, erc725yAbi, provider);
    
    try {
      // Try to get profile data (multiple keys)
      const keys = [LSP3_PROFILE_KEY, LSP3_NAME_KEY, LSP3_DESCRIPTION_KEY, LSP3_PROFILE_IMAGE_KEY, LSP3_LINKS_KEY];
      const profileData = await profileContract.getDataBatch(keys);
      
      let name = `LUKSO Address (${address.substring(0, 8)}...)`;
      let description = "LUKSO Universal Profile";
      let profileImage = "";
      let links: Record<string, string> = {};
      
      // Process the combined LSP3 Profile data first (backward compatibility)
      if (profileData[0] && profileData[0] !== "0x") {
        try {
          const decodedProfile = decodeLSP3ProfileData(profileData[0]);
          
          if (decodedProfile) {
            // Parse JSON data if possible
            if (typeof decodedProfile === "string") {
              try {
                const profileJson = JSON.parse(decodedProfile);
                if (profileJson.LSP3Profile) {
                  name = profileJson.LSP3Profile.name || name;
                  description = profileJson.LSP3Profile.description || description;
                  
                  // Get the profile image if available
                  if (profileJson.LSP3Profile.profileImage && 
                      profileJson.LSP3Profile.profileImage.length > 0) {
                    const image = profileJson.LSP3Profile.profileImage[0];
                    if (image.url) {
                      profileImage = image.url;
                    }
                  }
                  
                  // Get links if available
                  if (profileJson.LSP3Profile.links && 
                      profileJson.LSP3Profile.links.length > 0) {
                    profileJson.LSP3Profile.links.forEach((link: any) => {
                      if (link.title && link.url) {
                        links[link.title] = link.url;
                      }
                    });
                  }
                }
              } catch (parseError) {
                console.error("Error parsing profile JSON:", parseError);
              }
            } else if (decodedProfile.LSP3Profile) {
              // Direct object access if already parsed
              name = decodedProfile.LSP3Profile.name || name;
              description = decodedProfile.LSP3Profile.description || description;
              
              // Same logic for image and links as above
              if (decodedProfile.LSP3Profile.profileImage && 
                  decodedProfile.LSP3Profile.profileImage.length > 0) {
                const image = decodedProfile.LSP3Profile.profileImage[0];
                if (image.url) {
                  profileImage = image.url;
                }
              }
              
              if (decodedProfile.LSP3Profile.links && 
                  decodedProfile.LSP3Profile.links.length > 0) {
                decodedProfile.LSP3Profile.links.forEach((link: any) => {
                  if (link.title && link.url) {
                    links[link.title] = link.url;
                  }
                });
              }
            }
          }
        } catch (parseError) {
          console.error("Error parsing profile data:", parseError);
        }
      }
      
      // Check individual keys (newer approach)
      // Try to get name
      if (profileData[1] && profileData[1] !== "0x") {
        const decodedName = decodeHexToText(profileData[1]);
        if (decodedName) {
          name = decodedName;
        }
      }
      
      // Try to get description
      if (profileData[2] && profileData[2] !== "0x") {
        const decodedDescription = decodeHexToText(profileData[2]);
        if (decodedDescription) {
          description = decodedDescription;
        }
      }
      
      // Try to get profile image
      if (profileData[3] && profileData[3] !== "0x") {
        try {
          const imageData = decodeLSP3ProfileData(profileData[3]);
          if (imageData && typeof imageData === "object" && imageData.length > 0) {
            if (imageData[0].url) {
              profileImage = imageData[0].url;
            }
          }
        } catch (error) {
          console.error("Error decoding profile image:", error);
        }
      }
      
      // Try to get links
      if (profileData[4] && profileData[4] !== "0x") {
        try {
          const linksData = decodeLSP3ProfileData(profileData[4]);
          if (linksData && typeof linksData === "object" && linksData.length > 0) {
            linksData.forEach((link: any) => {
              if (link.title && link.url) {
                links[link.title] = link.url;
              }
            });
          }
        } catch (error) {
          console.error("Error decoding links:", error);
        }
      }
      
      return {
        address,
        name,
        description,
        profileImage,
        links
      };
    } catch (error) {
      // If error with contract, return basic info
      console.error("Error fetching profile data:", error);
      return {
        address,
        name: `Address ${address.substring(0, 8)}...`,
        description: "LUKSO Address",
        profileImage: "",
        links: {}
      };
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    return {
      address,
      name: `Address ${address.substring(0, 8)}...`,
      description: "Could not load profile data",
      profileImage: "",
      links: {}
    };
  }
}

/**
 * Get token balance
 */
async function getTokenBalance(address: string): Promise<any> {
  try {
    // Create contract instance for the Universal Profile
    const profileContract = new ethers.Contract(address, erc725yAbi, provider);
    const tokens: any[] = [];
    
    // Get LYX balance (native token)
    const lyxBalance = await provider.getBalance(address);
    const formattedLyxBalance = ethers.formatEther(lyxBalance);
    
    // Add LYX as the first token
    tokens.push({ 
      symbol: "LYX", 
      name: "LUKSO",
      address: "native",
      balance: formattedLyxBalance,
      formattedBalance: formattedLyxBalance,
      decimals: 18, 
      value: `$${(parseFloat(formattedLyxBalance) * 5).toFixed(2)}` // Sample price
    });
    
    try {
      // Get received assets (LSP5)
      const [receivedAssetsData] = await profileContract.getData([LSP5_RECEIVED_ASSETS_KEY]);
      const receivedAssets = decodeAssetsArray(receivedAssetsData);
      
      // Limit the number of tokens to fetch (to prevent too many requests)
      const assetLimit = Math.min(5, receivedAssets.length);
      const processedAssets = [];
      
      // Process each asset to determine if it's an LSP7 token
      for (let i = 0; i < assetLimit; i++) {
        const assetAddress = receivedAssets[i];
        try {
          // Try to interact with it as an LSP7 contract
          const assetContract = new ethers.Contract(assetAddress, lsp7Abi, provider);
          
          // Check if this address has a balance of this token
          try {
            const balance = await assetContract.balanceOf(address);
            
            if (balance > 0n) {
              // Get token metadata
              const [name, symbol, decimals] = await Promise.all([
                assetContract.name().catch(() => "Unknown Token"),
                assetContract.symbol().catch(() => "TKN"),
                assetContract.decimals().catch(() => 18)
              ]);
              
              // Format balance with proper decimals
              const formattedBalance = ethers.formatUnits(balance, decimals);
              
              // Add to tokens list
              tokens.push({
                symbol: symbol,
                name: name,
                address: assetAddress,
                balance: balance.toString(),
                formattedBalance: formattedBalance,
                decimals: decimals,
                value: `$${(parseFloat(formattedBalance) * 1).toFixed(2)}` // Sample price
              });
              
              processedAssets.push(assetAddress);
            }
          } catch (error) {
            console.error(`Error getting balance for ${assetAddress}:`, error);
          }
        } catch (error) {
          // Skip assets that don't implement the LSP7 interface
          console.error(`Error processing LSP7 asset at ${assetAddress}:`, error);
        }
      }
      
      // If we processed fewer tokens than the limit, note that there are more
      if (receivedAssets.length > assetLimit) {
        const remainingCount = receivedAssets.length - processedAssets.length;
        tokens.push({
          symbol: "...",
          name: `And ${remainingCount} more tokens`,
          address: "",
          balance: "",
          formattedBalance: "",
          decimals: 0,
          value: ""
        });
      }
    } catch (error) {
      console.error("Error fetching LSP7 tokens:", error);
    }
    
    return {
      address,
      tokens
    };
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return {
      address,
      tokens: [
        { symbol: "LYX", balance: "Error", value: "Error" }
      ]
    };
  }
}

/**
 * Get transaction history using GraphQL
 */
async function getTransactionHistory(address: string): Promise<any> {
  try {
    console.log(`Getting transaction history for address: ${address}`);
    console.log(`Using GraphQL endpoint: ${LUKSO_API_URL}`);
    
    // Add wildcard for partial address matching
    const wildcardAddress = `%${address.toLowerCase()}%`;
    const result = await graphQLClient.request(
      GET_TRANSACTIONS_QUERY,
      { address: wildcardAddress }
    );
    
    console.log(`Transaction result:`, JSON.stringify(result, null, 2));
    
    const data = result as any;
    
    if (data.Transaction && Array.isArray(data.Transaction)) {
      const transactions = data.Transaction.map((tx: any) => {
        const isSender = tx.from?.toLowerCase() === address.toLowerCase();
        const direction = isSender ? "send" : "receive";
        const value = ethers.formatEther(tx.value || "0");
        
        // Format timestamp (timestamp is typically in seconds since epoch)
        const timestamp = tx.timestamp
          ? new Date(Number(tx.timestamp) * 1000).toLocaleDateString()
          : "Unknown date";
        
        return {
          hash: tx.id,
          type: direction,
          value: `${value} LYX`,
          timestamp
        };
      });
      
      return {
        address,
        transactions: transactions.length > 0 ? transactions : [
          { hash: "No transactions found", type: "-", value: "-", timestamp: "-" }
        ]
      };
    }
    
    // If we couldn't get transactions from the Explorer API, try getting them from the RPC
    try {
      // Fallback to on-chain query for recent transactions
      console.log("Falling back to RPC for transactions...");
      const latestBlock = await provider.getBlockNumber();
      
      // Look back a few blocks for transactions
      const lookbackBlocks = 5;
      const startBlock = Math.max(0, latestBlock - lookbackBlocks);
      
      const fallbackTxs = [];
      
      for (let blockNum = latestBlock; blockNum >= startBlock; blockNum--) {
        try {
          const block = await provider.getBlock(blockNum);
          if (block && block.transactions) {
            for (const txHash of block.transactions.slice(0, 10)) { // Check first 10 txs in each block
              const tx = await provider.getTransaction(txHash);
              if (tx) {
                if (tx.from.toLowerCase() === address.toLowerCase() || 
                    (tx.to && tx.to.toLowerCase() === address.toLowerCase())) {
                  
                  const isSender = tx.from.toLowerCase() === address.toLowerCase();
                  const direction = isSender ? "send" : "receive";
                  const value = ethers.formatEther(tx.value || 0n);
                  
                  fallbackTxs.push({
                    hash: tx.hash,
                    type: direction,
                    value: `${value} LYX`,
                    timestamp: "Recent"
                  });
                  
                  if (fallbackTxs.length >= 5) break; // Limit to 5 transactions
                }
              }
            }
          }
          
          if (fallbackTxs.length >= 5) break; // Limit to 5 transactions
        } catch (blockError) {
          console.error(`Error fetching block ${blockNum}:`, blockError);
        }
      }
      
      return {
        address,
        transactions: fallbackTxs.length > 0 ? fallbackTxs : [
          { hash: "No transactions found", type: "-", value: "-", timestamp: "-" }
        ]
      };
    } catch (rpcError) {
      console.error("Error fetching transactions from RPC:", rpcError);
    }
    
    // Fallback to placeholder if no data
    return {
      address,
      transactions: [
        { 
          type: "Note", 
          hash: "", 
          description: "Transaction history is temporarily unavailable - please try again later" 
        }
      ]
    };
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return {
      address,
      transactions: [
        { type: "Error", hash: "", description: "Error fetching transaction history" }
      ]
    };
  }
}

/**
 * Get NFTs for address
 */
async function getNFTs(address: string): Promise<any> {
  try {
    console.log(`Getting NFTs for address: ${address}`);
    
    // Create contract instance for the Universal Profile
    const profileContract = new ethers.Contract(address, erc725yAbi, provider);
    const nfts: any[] = [];
    
    // Arrays to store assets
    let issuedAssets: string[] = [];
    let receivedAssets: string[] = [];
    
    try {
      // 1. Try to get LSP12 Issued Assets (tokens created by this profile)
      try {
        const issuedAssetsData = await profileContract.getData([LSP12_ISSUED_ASSETS_KEY])
          .catch(() => ["0x"]);
        
        // Make sure we have valid data and it's an array
        if (Array.isArray(issuedAssetsData) && issuedAssetsData[0]) {
          issuedAssets = decodeAssetsArray(issuedAssetsData[0]);
        }
        console.log(`Found ${issuedAssets.length} issued assets`);
      } catch (error) {
        console.error("Error fetching issued assets:", error);
      }
      
      // 2. Try to get LSP5 Received Assets (tokens owned by this profile)
      try {
        const receivedAssetsData = await profileContract.getData([LSP5_RECEIVED_ASSETS_KEY])
          .catch(() => ["0x"]);
        
        // Make sure we have valid data and it's an array  
        if (Array.isArray(receivedAssetsData) && receivedAssetsData[0]) {
          receivedAssets = decodeAssetsArray(receivedAssetsData[0]);
        }
        console.log(`Found ${receivedAssets.length} received assets`);
      } catch (error) {
        console.error("Error fetching received assets:", error);
      }
      
      // Combine unique assets from both lists
      const allAssets = [...new Set([...issuedAssets, ...receivedAssets])];
      
      // Process each asset to determine if it's an LSP8 NFT
      for (const assetAddress of allAssets) {
        try {
          // Skip invalid addresses
          if (!ethers.isAddress(assetAddress)) {
            continue;
          }
          
          // Try to interact with it as an LSP8 contract
          const assetContract = new ethers.Contract(assetAddress, lsp8Abi, provider);
          
          // Check if this address owns any tokens from this contract
          const balance = await assetContract.balanceOf(address)
            .catch(() => 0n);
          
          if (balance > 0n) {
            // Get basic contract metadata
            let name = "Unknown NFT";
            let symbol = "NFT";
            
            try {
              name = await assetContract.name().catch(() => "Unknown NFT");
              symbol = await assetContract.symbol().catch(() => "NFT");
            } catch (error) {
              console.error(`Error getting name/symbol for ${assetAddress}:`, error);
            }
            
            // Get token IDs owned by this address - handle errors gracefully
            let tokenIds: any[] = [];
            try {
              tokenIds = await assetContract.tokenIdsOf(address);
            } catch (error) {
              console.error(`Error getting token IDs for ${assetAddress}:`, error);
              
              // Add a placeholder entry since we know they own tokens but can't list them
              nfts.push({
                id: `error-${assetAddress}`,
                name: `${name} (${symbol})`,
                description: `You own ${balance.toString()} tokens from this collection, but details can't be retrieved`,
                contract: assetAddress,
                imageUrl: "",
                isIssued: issuedAssets.includes(assetAddress)
              });
              continue;
            }
            
            // Make sure tokenIds is valid and not empty
            if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
              continue;
            }
            
            // Get metadata for first few tokens (limit to 5 to prevent too many requests)
            const tokenLimit = Math.min(5, tokenIds.length);
            
            // Collection metadata
            const collectionData = {
              name,
              symbol,
              contractAddress: assetAddress,
              standard: "LSP8",
              isIssued: issuedAssets.includes(assetAddress),
              totalOwned: tokenIds.length
            };
            
            for (let i = 0; i < tokenLimit; i++) {
              try {
                const tokenId = tokenIds[i];
                if (!tokenId) continue;
                
                // Get the token owner to verify ownership - handle errors
                let tokenOwner = "";
                try {
                  tokenOwner = await assetContract.tokenOwnerOf(tokenId)
                    .catch(() => "");
                } catch (error) {
                  console.error(`Error getting token owner for ${tokenId}:`, error);
                }
                
                // Skip if the token is not owned by this address anymore
                if (tokenOwner && tokenOwner.toLowerCase() !== address.toLowerCase()) {
                  continue;
                }
                
                // Try to get token metadata using LSP8's tokenURI
                let tokenUri = "";
                let imageUrl = "";
                let metadata = null;
                
                try {
                  tokenUri = await assetContract.tokenURI(tokenId)
                    .catch(() => "");
                  
                  // Generate a token ID string that can be displayed
                  const displayTokenId = typeof tokenId === 'string' ? 
                    tokenId : tokenId.toString();
                  const shortTokenId = displayTokenId.slice(0, 8);
                  
                  // If the URI is IPFS based, format it for HTTP gateway access
                  if (tokenUri && tokenUri.startsWith("ipfs://")) {
                    const ipfsHash = tokenUri.replace("ipfs://", "");
                    // Use a public IPFS gateway
                    const ipfsGatewayUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
                    
                    metadata = {
                      name: `${name} #${shortTokenId}`,
                      description: "LUKSO NFT",
                      image: ipfsGatewayUrl
                    };
                    
                    imageUrl = ipfsGatewayUrl;
                  } else if (tokenUri && tokenUri.startsWith("http")) {
                    imageUrl = tokenUri;
                    metadata = {
                      name: `${name} #${shortTokenId}`,
                      description: "LUKSO NFT",
                      image: tokenUri
                    };
                  }
                } catch (error) {
                  console.error(`Error getting token URI for ${assetAddress} token ${tokenId}:`, error);
                }
                
                // Add the token to the list with proper error handling for display
                const tokenDisplay = typeof tokenId === 'string' ? 
                  tokenId : tokenId.toString();
                const shortDisplay = tokenDisplay.slice(0, 8);
                
                nfts.push({
                  id: tokenDisplay,
                  name: metadata?.name || `${name} #${shortDisplay}`,
                  description: metadata?.description || `Token from ${name} collection`,
                  contract: assetAddress,
                  contractName: name,
                  symbol: symbol,
                  tokenId: tokenDisplay,
                  imageUrl: imageUrl,
                  tokenUri: tokenUri,
                  isIssued: issuedAssets.includes(assetAddress),
                  collection: collectionData
                });
              } catch (error) {
                console.error(`Error processing token ${i}:`, error);
              }
            }
            
            // If we have more tokens than the limit, add a placeholder
            if (tokenIds.length > tokenLimit) {
              nfts.push({
                id: "more",
                name: `+ ${tokenIds.length - tokenLimit} more from ${name}`,
                description: `${tokenIds.length - tokenLimit} more tokens not shown`,
                contract: assetAddress,
                contractName: name,
                symbol: symbol,
                tokenId: "",
                imageUrl: "",
                isIssued: issuedAssets.includes(assetAddress),
                collection: collectionData
              });
            }
          }
        } catch (error) {
          // Skip assets that don't implement the LSP8 interface
          console.error(`Error processing asset at ${assetAddress}:`, error);
        }
      }
      
      // If no NFTs were found, return a message
      if (nfts.length === 0) {
        return {
          address,
          nfts: [
            { id: "No NFTs found", name: "No LSP8 NFTs found for this address", imageUrl: "" }
          ]
        };
      }
      
      return {
        address,
        nfts
      };
    } catch (error) {
      console.error("Error fetching LSP assets:", error);
      return {
        address,
        nfts: [
          { id: "Error", name: "Error fetching NFTs", imageUrl: "" }
        ]
      };
    }
  } catch (error) {
    console.error("Error fetching NFTs:", error);
    return {
      address,
      nfts: [
        { id: "Error", name: "Error fetching NFTs", imageUrl: "" }
      ]
    };
  }
}

/**
 * Query LUKSO data based on command
 */
async function queryLuksoData(command: string, params: Record<string, string>): Promise<any> {
  const address = params.address;
  
  // Validate Ethereum address
  if (!ethers.isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  
  // Route to the appropriate handler
  switch (command) {
    case "profile":
      return getProfileData(address);
    case "tokens":
      return getTokenBalance(address);
    case "transactions":
      return getTransactionHistory(address);
    case "nfts":
      // Try GraphQL first, then fall back to blockchain method
      try {
        const graphqlResult = await getNFTsViaGraphQL(address);
        if (graphqlResult && graphqlResult.nfts && graphqlResult.nfts.length > 0 && 
            graphqlResult.nfts[0].id !== "No NFTs found" && 
            graphqlResult.nfts[0].id !== "Error") {
          console.log("Successfully retrieved NFTs via GraphQL");
          return graphqlResult;
        }
        
        console.log("Falling back to blockchain method for NFTs");
        return getNFTs(address);
      } catch (error) {
        console.error("Error with GraphQL NFT retrieval, falling back:", error);
        return getNFTs(address);
      }
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}

/**
 * Get AI response from OpenAI
 */
async function getAIResponse(message: string): Promise<string> {
  try {
    // If OpenAI API key is not provided, return a default response
    if (!openai) {
      return "AI responses are currently disabled. Please contact the administrator to enable this feature.";
    }
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: message }],
      model: "gpt-4.1-mini", // You can change to a different model
    });

    return completion.choices[0]?.message?.content || 
      "I'm not sure how to respond to that.";
  } catch (error) {
    console.error("Error getting AI response:", error);
    return "Sorry, I couldn't generate a response. Please try again later.";
  }
}

/**
 * Process user message
 */
async function processMessage(
  content: string,
  senderAddress: string,
  agentAddress: string,
  lyxHandler: LYXHandler,
  conversation: any,
  client: Client
): Promise<{ text?: string; contentType?: any; content?: any }> {
  const parts = content.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  // Handle groups and search commands
  if (command === "/search") {
    // Search for Universal Profiles
    if (args.length === 0) {
      return { text: "Please provide a search term. Usage: /search <name>" };
    }
    
    const searchTerm = args.join(" ");
    try {
      const profiles = await searchUniversalProfiles(searchTerm);
      
      if (profiles.length === 0) {
        return { text: `No Universal Profiles found matching "${searchTerm}"` };
      }
      
      const profilesList = profiles.map((profile, index) => 
        `${index + 1}. ${profile.name || "Unnamed"} - ${profile.accountAddress || profile.address}\n   ${profile.description || ""}`
      ).join("\n\n");
      
      return { 
        text: `Found ${profiles.length} accounts matching "${searchTerm}":\n\n${profilesList}\n\nUse /query <address> to get more details.` 
      };
    } catch (error) {
      console.error("Error searching profiles:", error);
      return { text: `Error searching for profiles: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (command === "/query") {
    // Get details about a specific Universal Profile
    if (args.length === 0) {
      return { text: "Please provide an address. Usage: /query <address>" };
    }
    
    const address = args[0];
    if (!ethers.isAddress(address)) {
      return { text: `Invalid Ethereum address: ${address}` };
    }
    
    try {
      // Get profile from blockchain API
      const profile = await getUniversalProfileByAddress(address);
      
      if (!profile) {
        // Fall back to on-chain lookup
        const onChainProfile = await getProfileData(address);
        return { 
          text: `Profile (on-chain) for ${address}:\nName: ${onChainProfile.name}\nDescription: ${onChainProfile.description}` 
        };
      }
      
      // Get transaction data (instead of assets)
      const txActivity = await getTransactionHistory(address);
      
      let txText = "";
      if (txActivity && txActivity.transactions) {
        const txCount = txActivity.transactions.length;
        txText = `\nRecent Transactions: ${txCount}`;
        
        if (txCount > 0) {
          txText += `\n${txActivity.transactions.slice(0, 3).map((tx: any) => 
            `- ${tx.type || "TX"}: ${tx.hash?.substring(0, 10)}...`
          ).join("\n")}`;
        }
      }
      
      return { 
        text: `Account for ${profile.accountAddress || profile.address}:\nName: ${profile.name || "Unnamed"}\nCreated: ${new Date(profile.createdAt * 1000).toLocaleDateString()}${txText}\n\nYou can run regular commands like tokens/nfts/profile with this address.` 
      };
    } catch (error) {
      console.error("Error querying profile:", error);
      return { text: `Error retrieving profile details: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (command === "/creategroup") {
    // Create a new group
    if (args.length < 2) {
      return { text: "Please provide a group name and at least one address. Usage: /creategroup <n> <address1> [address2...]" };
    }
    
    const groupName = args[0];
    const addresses = args.slice(1);
    
    // Validate addresses
    const validAddresses = addresses.filter(addr => ethers.isAddress(addr));
    if (validAddresses.length === 0) {
      return { text: "No valid addresses provided. Please provide at least one valid Ethereum address." };
    }
    
    try {
      // Try to get inbox IDs for the addresses
      const inboxIds: string[] = [];
      
      for (const address of validAddresses) {
        try {
          // Let's try to find XMTP users directly by checking for DM capabilities
          // This is a workaround since some API methods might not be available
          let foundUser = false;
          
          try {
            // Try to create a DM conversation with the address (this checks if user exists)
            const dm = await client.conversations.newDmWithIdentifier({
              identifierKind: IdentifierKind.Ethereum,
              identifier: address,
            });
            
            if (dm && dm.peerInboxId) {
              inboxIds.push(dm.peerInboxId);
              foundUser = true;
            }
          } catch (error) {
            console.warn(`Couldn't create DM for XMTP user at address ${address}`);
          }
          
          if (!foundUser) {
            console.warn(`Couldn't find XMTP user for address ${address}`);
          }
        } catch (error) {
          console.warn(`Error finding XMTP user for address ${address}:`, error);
        }
      }
      
      if (inboxIds.length === 0) {
        return { text: "None of the provided addresses are registered on XMTP. Group creation requires at least one XMTP user." };
      }
      
      // Include the sender in the group
      const senderInboxId = conversation.peerInboxId;
      if (senderInboxId && !inboxIds.includes(senderInboxId)) {
        inboxIds.push(senderInboxId);
      }
      
      // Create the group
      const group = await createNewGroup(
        client,
        groupName,
        `Group created by LUKSO agent for ${senderAddress}`,
        inboxIds
      );
      
      if (!group) {
        return { text: "Error creating group. Please try again." };
      }
      
      // Save groups to cache
      saveGroupsToCache();
      
      // Send a welcome message to the group
      await group.send(`Welcome to the "${groupName}" group! This group was created by ${senderAddress} and has ${inboxIds.length} initial members.`);
      
      return { 
        text: `Successfully created group "${groupName}" with ${inboxIds.length} members. Group ID: ${group.id}` 
      };
    } catch (error) {
      console.error("Error creating group:", error);
      return { text: `Error creating group: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (command === "/addtogroup") {
    // Add a member to a group
    if (args.length < 2) {
      return { text: "Please provide a group ID and at least one address. Usage: /addtogroup <groupId> <address>" };
    }
    
    const groupId = args[0];
    const address = args[1];
    
    if (!ethers.isAddress(address)) {
      return { text: `Invalid Ethereum address: ${address}` };
    }
    
    // Check if group exists
    const group = activeGroups.get(groupId);
    if (!group) {
      return { text: `Group with ID ${groupId} not found or not cached` };
    }
    
    try {
      // Get inbox ID for the address using our helper
      const inboxId = await getInboxIdFromAddress(client, address);
      
      if (!inboxId) {
        return { text: `Address ${address} is not registered on XMTP.` };
      }
      
      // Add member to group
      const result = await addMemberToGroup(groupId, inboxId);
      
      if (result) {
        return { text: `Successfully added ${address} to the group.` };
      } else {
        return { text: `Failed to add ${address} to the group.` };
      }
    } catch (error) {
      console.error("Error adding to group:", error);
      return { text: `Error adding to group: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (command === "/nftaddtogroup") {
    // Add NFT holders to a group
    if (args.length < 2) {
      return { text: "Please provide a group ID and NFT address. Usage: /nftaddtogroup <groupId> <nftAddress>" };
    }
    
    const groupId = args[0];
    const nftAddress = args[1];
    
    if (!ethers.isAddress(nftAddress)) {
      return { text: `Invalid NFT address: ${nftAddress}` };
    }
    
    try {
      const result = await addNFTHoldersToGroup(client, groupId, nftAddress);
      
      return { text: result.message };
    } catch (error) {
      console.error("Error adding NFT holders:", error);
      return { text: `Error adding NFT holders: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (command === "/listgroups") {
    // List all active groups
    if (activeGroups.size === 0) {
      return { text: "No active groups. Create a group with /creategroup <name> <address1> [address2...]" };
    }
    
    const groupsList = Array.from(activeGroups.entries()).map(([id, group]) => {
      return `- ${group.name || "Unnamed Group"} (ID: ${id})`;
    }).join("\n");
    
    return { text: `Active Groups:\n${groupsList}` };
  } else if (command === "/listmembers") {
    // List members in a group
    if (args.length === 0) {
      return { text: "Please provide a group ID. Usage: /listmembers <groupId>" };
    }
    
    const groupId = args[0];
    
    try {
      const members = await listGroupMembers(groupId);
      
      if (members.length === 0) {
        return { text: `No members found in group ${groupId}` };
      }
      
      const membersList = await Promise.all(members.map(async (member) => {
        // Try to find an Ethereum identifier
        const ethId = member.accountIdentifiers.find(id => id.identifierKind === 0);
        let addressStr = "Unknown address";
        
        if (ethId) {
          addressStr = ethId.identifier;
          
          // Try to get profile info
          try {
            const profile = await getUniversalProfileByAddress(addressStr);
            if (profile) {
              return `- ${profile.name || "Unnamed"} (${addressStr})`;
            }
          } catch (error) {
            // Ignore errors here
          }
        }
        
        return `- ${addressStr}`;
      }));
      
      return { text: `Members in group (${members.length}):\n${membersList.join("\n")}` };
    } catch (error) {
      console.error("Error listing members:", error);
      return { text: `Error listing members: ${error instanceof Error ? error.message : String(error)}` };
    }
  } else if (command === "/removefromgroup") {
    // Remove a member from a group
    if (args.length < 2) {
      return { text: "Please provide a group ID and address. Usage: /removefromgroup <groupId> <address>" };
    }
    
    const groupId = args[0];
    const address = args[1];
    
    if (!ethers.isAddress(address)) {
      return { text: `Invalid Ethereum address: ${address}` };
    }
    
    try {
      // Get inbox ID for the address using our helper
      const inboxId = await getInboxIdFromAddress(client, address);
      
      if (!inboxId) {
        return { text: `Address ${address} is not registered on XMTP.` };
      }
      
      // Remove member from group
      const result = await removeMemberFromGroup(groupId, inboxId);
      
      if (result) {
        return { text: `Successfully removed ${address} from the group.` };
      } else {
        return { text: `Failed to remove ${address} from the group.` };
      }
    } catch (error) {
      console.error("Error removing from group:", error);
      return { text: `Error removing from group: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  
  // LYX Transaction commands
  if (command === "/balance") {
    try {
      const result = await lyxHandler.getLYXBalance(agentAddress);
      return { text: `Your LYX balance is: ${result}` };
    } catch (error) {
      console.error("Error getting balance:", error);
      return { text: "Error fetching balance. Please try again." };
    }
  } else if (command === "/tx" || command.startsWith("/tx ")) {
    // Handle transaction command without requiring OpenAI
    // Updated to support both amount and address parameters
    const txParts = content.substring(4).trim().split(" ");
    
    // Check if we have at least the amount
    if (txParts.length === 0 || txParts[0] === "") {
      return { text: "Please provide a valid amount and optionally a recipient address. Usage: /tx <amount> [address]" };
    }
    
    const amount = parseFloat(txParts[0]);
    if (isNaN(amount) || amount <= 0) {
      return { text: "Please provide a valid amount. Usage: /tx <amount> [address]" };
    }
    
    // Get the recipient address (optional)
    let recipientAddress = agentAddress; // Default to agent address
    
    if (txParts.length > 1) {
      const providedAddress = txParts[1];
      if (ethers.isAddress(providedAddress)) {
        recipientAddress = providedAddress;
      } else {
        return { text: `Invalid recipient address: ${providedAddress}. Usage: /tx <amount> [address]` };
      }
    }

    try {
      // Get sender balance to check if they have enough
      const senderBalance = await lyxHandler.getLYXBalance(senderAddress);
      const senderBalanceEth = parseFloat(senderBalance);
      
      if (senderBalanceEth < amount) {
        return { text: `You don't have enough LYX. Your balance is ${senderBalanceEth} LYX but you're trying to send ${amount} LYX.` };
      }
      
      // Create wallet send calls using the LYXHandler
      const walletSendCalls = lyxHandler.createLYXTransferCalls(
        senderAddress,
        recipientAddress,
        amount
      );
      
      console.log("Created wallet send calls:", JSON.stringify(walletSendCalls, null, 2));
      
      return { 
        content: walletSendCalls, 
        contentType: ContentTypeWalletSendCalls 
      };
    } catch (error) {
      console.error("Error processing transaction:", error);
      return { text: `Error processing transaction: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  
  // Help command
  if (command === "help" || command === "/help") {
    return {
      text: `
Available LUKSO Blockchain Commands:
- profile <address> - Get LUKSO Universal Profile information
- nfts <address> - List LSP8 NFTs owned or issued by an address
- tokens <address> - Get LYX and LSP7 token balances
- transactions <address> - View recent transactions

Transaction Commands:
- /balance - Check your LYX balance
- /tx <amount> [address] - Send LYX to the specified address (or to the agent if address is omitted)

Search & User Commands:
- /search <term> - Search for Universal Profiles by name
- /query <address> - Get detailed info about a Universal Profile

Group Management Commands:
- /creategroup <name> <address1> [address2...] - Create a new group
- /addtogroup <groupId> <address> - Add a member to a group
- /nftaddtogroup <groupId> <nftAddress> - Add NFT holders to a group
- /listgroups - List all active groups
- /listmembers <groupId> - List members in a group
- /removefromgroup <groupId> <address> - Remove a member from a group

Help:
- help - Show this help message

Example: profile 0x123...

This agent supports:
• Full LUKSO Universal Profile data decoding
• LSP7 Digital Asset tokens
• LSP8 Identifiable Digital Asset NFTs
• Native LYX token transactions
• Universal Profile search via subgraph
• NFT-gated group management

You can also ask me any question and I'll try to respond with AI.
      `.trim()
    };
  }
  
  // LUKSO blockchain commands
  const validCommands = ["profile", "nfts", "tokens", "transactions"];
  if (validCommands.includes(command)) {
    // Check for address parameter
    if (args.length === 0) {
      return { text: `Please provide an address for the ${command} command.` };
    }
    
    const address = args[0];
    
    try {
      // Query blockchain data
      const result = await queryLuksoData(command, { address });
      
      // Format response based on command
      switch (command) {
        case "profile":
          return {
            text: `
Profile for ${result.address}:
Name: ${result.name}
Description: ${result.description}
${result.profileImage ? `Image: ${result.profileImage}` : ""}
${result.links.website ? `Website: ${result.links.website}` : ""}
${result.links.twitter ? `Twitter: ${result.links.twitter}` : ""}
            `.trim()
          };
        
        case "nfts":
          return {
            text: `
NFTs owned by ${result.address}:
${result.nfts.map((nft: any) => {
  let nftLine = `- ${nft.name}`;
  
  // Add collection info if available
  if (nft.collection) {
    nftLine += `\n  Collection: ${nft.collection.name}`;
    
    if (nft.collection.symbol) {
      nftLine += ` (${nft.collection.symbol})`;
    }
    
    if (nft.collection.standard) {
      nftLine += ` - ${nft.collection.standard}`;
    }
  }
  
  // Add token ID if available (except for placeholders)
  if (nft.tokenId && nft.id !== "more") {
    nftLine += `\n  Token ID: ${nft.tokenId.slice(0, 10)}...`;
  }
  
  // Add contract address if available
  if (nft.contract) {
    nftLine += `\n  Contract: ${nft.contract}`;
  }
  
  // Add image URL if available
  if (nft.imageUrl) {
    nftLine += `\n  Image: ${nft.imageUrl}`;
  }
  
  // Add issued by status if available
  if (nft.isIssued === true) {
    nftLine += `\n  Issued by this address`;
  }
  
  return nftLine;
}).join("\n\n")}
            `.trim()
          };
        
        case "tokens":
          return {
            text: `
Tokens owned by ${result.address}:
${result.tokens.map((token: any) => {
  let tokenLine = `- ${token.symbol}`;
  
  // Add token name if available and different from symbol
  if (token.name && token.name !== token.symbol) {
    tokenLine += ` (${token.name})`;
  }
  
  // Add balance if available
  if (token.formattedBalance) {
    tokenLine += `: ${token.formattedBalance}`;
  } else if (token.balance) {
    tokenLine += `: ${token.balance}`;
  }
  
  // Add value if available
  if (token.value) {
    tokenLine += ` ${token.value}`;
  }
  
  // Add token contract address if available (except for LYX)
  if (token.address && token.address !== "native") {
    tokenLine += `\n  Contract: ${token.address}`;
  }
  
  return tokenLine;
}).join("\n")}
            `.trim()
          };
        
        case "transactions":
          return {
            text: `
Recent transactions for ${result.address}:
${result.transactions.map((tx: any) => `- ${tx.timestamp}: ${tx.type} ${tx.value}`).join("\n")}
            `.trim()
          };
        
        default:
          return { text: "Invalid command. Send 'help' to see available commands." };
      }
    } catch (error) {
      console.error("Error processing message:", error);
      return { 
        text: `Error processing ${command} command: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  // If not a recognized command, process with AI
  const aiResponse = await getAIResponse(content);
  return { text: aiResponse };
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("Starting LUKSO XMTP Agent...");
    console.log(`Connected to LUKSO blockchain at ${LUKSO_RPC}`);
    
    // Initialize LYX handler
    const lyxHandler = new LYXHandler(NETWORK_ID);
    
    // Initialize XMTP client
    const signer = createSigner(WALLET_KEY as string);
    const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY as string);
    
    const client = await Client.create(signer, {
      dbEncryptionKey,
      env: XMTP_ENV as XmtpEnv,
      dbPath: getDbPath(XMTP_ENV),
      loggingLevel: LOGGING_LEVEL as LogLevel,
      codecs: [new WalletSendCallsCodec(), new TransactionReferenceCodec()],
    });
    
    void logAgentDetails(client);
    
    // Get agent address from signer
    const identifier = await signer.getIdentifier();
    const agentAddress = identifier.identifier;
    
    console.log("✓ Syncing conversations...");
    await client.conversations.sync();
    
    // Load existing groups
    console.log("Loading existing groups...");
    try {
      const conversations = await client.conversations.list();
      for (const conversation of conversations) {
        if (conversation instanceof Group) {
          // Add to active groups cache
          activeGroups.set(conversation.id, conversation);
          console.log(`Loaded group: ${conversation.name || "Unnamed"} (ID: ${conversation.id})`);
        }
      }
      console.log(`Loaded ${activeGroups.size} active groups`);
    } catch (error) {
      console.error("Error loading existing groups:", error);
    }
    
    // Implement stream retry logic for robustness
    let retryCount = 0;
    
    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Starting message stream... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        const stream = await client.conversations.streamAllMessages();
        
        console.log("Waiting for messages...");
        for await (const message of stream) {
          // Ignore messages from the same agent or non-text messages
          if (
            message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
            message?.contentType?.typeId !== "text"
          ) {
            continue;
          }
          
          console.log(`Received message: ${message.content as string} from ${message.senderInboxId}`);
          
          // Get conversation
          const conversation = await client.conversations.getConversationById(
            message.conversationId
          );
          
          if (!conversation) {
            console.log("Unable to find conversation, skipping");
            continue;
          }
          
          // If this is a group conversation, add it to activeGroups cache if not already there
          if (conversation instanceof Group && !activeGroups.has(conversation.id)) {
            activeGroups.set(conversation.id, conversation);
            console.log(`Added group to cache: ${conversation.name || "Unnamed"} (ID: ${conversation.id})`);
          }
          
          try {
            // Get sender address from inboxId
            const inboxState = await client.preferences.inboxStateFromInboxIds([
              message.senderInboxId,
            ]);
            const senderAddress = inboxState[0].identifiers[0].identifier;
            
            // Process message and prepare response
            const response = await processMessage(
              message.content as string,
              senderAddress,
              agentAddress,
              lyxHandler,
              conversation,
              client
            );
            
            // Send appropriate response
            if (response.text) {
              console.log(`Sending response: ${response.text}`);
              await conversation.send(response.text);
            } else if (response.content && response.contentType) {
              console.log(`Sending custom content type response`);
              await conversation.send(response.content, response.contentType);
            }
          } catch (error) {
            console.error("Error processing message:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            await conversation.send(`An error occurred: ${errorMessage}`);
          }
        }
        
        // If we get here without an error, reset the retry count
        retryCount = 0;
      } catch (error) {
        retryCount++;
        console.error("Stream error:", error);
        if (retryCount < MAX_RETRIES) {
          console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
          await sleep(RETRY_DELAY_MS);
        } else {
          console.log("Maximum retry attempts reached.");
        }
      }
    }
    
    console.log("Stream processing ended after maximum retries.");
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit();
});

// Start the agent
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// GraphQL endpoint for LUKSO
const LUKSO_API_MAINNET = "https://envio.lukso-mainnet.universal.tech/v1/graphql";
const LUKSO_API_TESTNET = "https://envio.lukso-testnet.universal.tech/v1/graphql";

const LUKSO_API_URL = NETWORK_ID === "lukso-mainnet" ? LUKSO_API_MAINNET : LUKSO_API_TESTNET;

// Initialize GraphQL client
const graphQLClient = new GraphQLClient(LUKSO_API_URL, {
  fetch, // Use cross-fetch for Node.js environments
  headers: {
    "Content-Type": "application/json",
  }
});

// Updated GraphQL query to search for profiles using Envio API
const SEARCH_PROFILES_QUERY = gql`
  query SearchProfiles($searchTerm: String!) {
    Profile(
      where: {
        _or: [
          { id: { _ilike: $searchTerm } },
          { name: { _ilike: $searchTerm } }
        ]
      },
      limit: 5
    ) {
      id
      name
      description
    }
  }
`;

// Updated GraphQL query to get transactions for an address using Envio API
const GET_TRANSACTIONS_QUERY = gql`
  query GetTransactions($address: String!) {
    Transaction(
      where: {
        _or: [
          { from: { _ilike: $address } },
          { to: { _ilike: $address } }
        ]
      },
      limit: 10,
      order_by: { timestamp: desc }
    ) {
      id
      from
      to
      value
      blockNumber
      timestamp
      gas
      gasUsed
    }
  }
`;

/**
 * Check for profile existence on external domains
 */
async function checkExternalProfiles(searchTerm: string): Promise<{ url: string; exists: boolean }[]> {
  const results: { url: string; exists: boolean }[] = [];
  
  // Check ENS domain
  const ensUrl = `https://app.ens.domains/${searchTerm}.eth`;
  try {
    // First check if the ENS name actually resolves
    const ensName = `${searchTerm}.eth`;
    const ensRegistry = new ethers.Contract(
      "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e", // ENS Registry address
      [
        "function resolver(bytes32 node) view returns (address)",
        "function owner(bytes32 node) view returns (address)"
      ],
      provider
    );

    // Get the namehash of the ENS name
    const namehash = ethers.namehash(ensName);
    console.log(`Checking ENS name: ${ensName}`);
    console.log(`Generated namehash: ${namehash}`);
    
    try {
      // Check if the name is owned (registered)
      const owner = await ensRegistry.owner(namehash);
      const isRegistered = owner !== "0x0000000000000000000000000000000000000000";
      
      console.log(`ENS ownership check for ${ensName}:`, {
        owner,
        isRegistered
      });

      if (isRegistered) {
        // Get the resolver address
        const resolverAddress = await ensRegistry.resolver(namehash);
        console.log(`Resolver address for ${ensName}: ${resolverAddress}`);
        
        if (resolverAddress !== "0x0000000000000000000000000000000000000000") {
          // Create resolver contract
          const resolver = new ethers.Contract(
            resolverAddress,
            ["function addr(bytes32 node) view returns (address)"],
            provider
          );
          
          // Get the resolved address
          const resolvedAddress = await resolver.addr(namehash);
          console.log(`Resolved address for ${ensName}: ${resolvedAddress}`);
          
          if (resolvedAddress !== "0x0000000000000000000000000000000000000000") {
            // Now check the ENS profile page
            const ensResponse = await fetch(ensUrl, { 
              method: 'GET',
              redirect: 'follow'
            });
            
            // Get the page content
            const text = await ensResponse.text();
            
            // Get the final URL after any redirects
            const finalUrl = ensResponse.url;
            
            console.log(`ENS web check for ${ensName}:`, {
              initialUrl: ensUrl,
              finalUrl,
              status: ensResponse.status,
              redirected: ensResponse.redirected
            });
            
            // A valid ENS profile must:
            // 1. Have a successful response
            // 2. Not be redirected to /register
            // 3. Not be on the registration page
            const isRedirectedToRegister = finalUrl.includes('/register');
            const isOnRegistrationPage = text.includes('Register your name') || 
                                      text.includes('Available to register') ||
                                      text.includes('This name is available');
            
            const exists = ensResponse.ok && 
                          !isRedirectedToRegister &&
                          !isOnRegistrationPage &&
                          !text.includes('Page not found') &&
                          !text.includes('404');
            
            console.log(`ENS profile exists check:`, {
              isRedirectedToRegister,
              isOnRegistrationPage,
              exists
            });
            
            if (exists) {
              results.push({
                url: ensUrl,
                exists: true
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error checking ENS registration for ${ensName}:`, error);
    }
  } catch (error) {
    console.error(`Error checking ENS profile for ${searchTerm}.eth:`, error);
  }
  
  // Check convos.org
  const convosUrl = `https://${searchTerm}.convos.org`;
  try {
    console.log(`Checking convos.org profile at: ${convosUrl}`);
    const convosResponse = await fetch(convosUrl, { 
      method: 'GET',
      redirect: 'follow'
    });
    
    // Get the page content to check for "Profile Not Found"
    const text = await convosResponse.text();
    
    // Check if it's a valid profile (not a "Profile Not Found" page)
    const exists = convosResponse.ok && 
                  !text.includes('Profile Not Found') &&
                  !text.includes('could not be found') &&
                  !convosResponse.url.includes('404');
    
    console.log(`Convos profile exists: ${exists}`);
    
    results.push({
      url: convosUrl,
      exists
    });
  } catch (error) {
    console.error(`Error checking convos.org profile:`, error);
    results.push({
      url: convosUrl,
      exists: false
    });
  }
  
  // Check base.org
  const baseUrl = `https://www.base.org/name/${searchTerm}`;
  try {
    console.log(`Checking base.org profile at: ${baseUrl}`);
    const baseResponse = await fetch(baseUrl, { 
      method: 'GET',
      redirect: 'follow'
    });
    
    console.log(`Base response status: ${baseResponse.status}`);
    console.log(`Base response URL: ${baseResponse.url}`);
    
    // Get the page content
    const text = await baseResponse.text();
    console.log(`Base response content length: ${text.length}`);
    
    // Log key content checks
    const hasBase = text.includes('Base');
    const hasActivity = text.includes('Activity');
    const hasExplore = text.includes('Explore ways to build your profile');
    const hasPageNotFound = text.includes('Page not found');
    const hasRegister = baseResponse.url.includes('/register');
    
    console.log('Base profile content checks:', {
      hasBase,
      hasActivity,
      hasExplore,
      hasPageNotFound,
      hasRegister
    });
    
    // Check if it's a valid profile by looking for specific content
    const exists = baseResponse.ok && 
                  hasBase && 
                  hasActivity && 
                  hasExplore && 
                  !hasPageNotFound &&
                  !hasRegister;
    
    console.log(`Base profile exists: ${exists}`);
    
    results.push({
      url: baseUrl,
      exists
    });
  } catch (error) {
    console.error(`Error checking base.org profile:`, error);
    results.push({
      url: baseUrl,
      exists: false
    });
  }
  
  return results;
}

/**
 * Search for Universal Profiles by name
 */
async function searchUniversalProfiles(searchTerm: string, limit: number = 5): Promise<any[]> {
  try {
    console.log(`Searching for profiles with term: "${searchTerm}"`);
    
    // Always try ENS resolution first
    let address = searchTerm;
    let ensName = searchTerm;
    
    // If it doesn't end with .eth, try adding it
    if (!searchTerm.toLowerCase().endsWith('.eth')) {
      ensName = `${searchTerm}.eth`;
    }
    
    // Try to resolve the ENS name
    const resolvedAddress = await resolveENSName(ensName);
    if (resolvedAddress) {
      address = resolvedAddress;
      console.log(`Resolved ENS name ${ensName} to address ${address}`);
    }
    
    let profiles: any[] = [];
    
    // Try Whisk API if we have an address
    if (address.startsWith('0x')) {
      try {
        const whiskResult = await whiskGraphQLClient.request(WHISK_PROFILE_QUERY, {
          address: address
        });
        
        if (whiskResult?.identity) {
          const whiskProfile = whiskResult.identity;
          const description = [
            whiskProfile.base?.name ? `Name: ${whiskProfile.base.name}` : null,
            whiskProfile.ens?.name ? `ENS: ${whiskProfile.ens.name}` : null,
            whiskProfile.farcaster?.name ? `Farcaster: ${whiskProfile.farcaster.name}` : null,
            whiskProfile.lens?.name ? `Lens: ${whiskProfile.lens.name}` : null
          ].filter(Boolean).join("\n");
          
          // Add ENS profile link if we have an ENS name
          const ensProfileUrl = whiskProfile.ens?.name ? 
            `https://app.ens.domains/${whiskProfile.ens.name}` : null;
          
          profiles.push({
            accountAddress: address,
            name: whiskProfile.base?.name || whiskProfile.ens?.name || `Address ${address.substring(0, 8)}...`,
            description: [
              description,
              ensProfileUrl ? `ENS Profile: ${ensProfileUrl}` : null
            ].filter(Boolean).join("\n"),
            createdAt: Math.floor(Date.now() / 1000)
          });
        }
      } catch (error) {
        console.error("Error getting Whisk profile data:", error);
      }
    }
    
    // Check external profiles
    const externalProfiles = await checkExternalProfiles(searchTerm);
    const existingExternalUrls = externalProfiles
      .filter(profile => profile.exists)
      .map(profile => profile.url);
    
    // Add external profile URLs to the results
    if (existingExternalUrls.length > 0) {
      const validExternalUrls = existingExternalUrls.filter(url => !url.includes('/register'));
      
      if (validExternalUrls.length > 0) {
        // Add ENS profile link if we have an ENS name
        const ensProfileUrl = ensName ? `https://app.ens.domains/${ensName}` : null;
        
        const description = [
          `Found profiles on: ${validExternalUrls.join(", ")}`,
          ensProfileUrl ? `ENS Profile: ${ensProfileUrl}` : null
        ].filter(Boolean).join("\n");
        
        profiles.push({
          accountAddress: "external",
          name: "External Profiles",
          description,
          createdAt: Math.floor(Date.now() / 1000)
        });
      }
    }
    
    // Add wildcard for partial matches in GraphQL search
    const wildcardTerm = `%${searchTerm}%`;
    console.log(`Searching GraphQL with term: "${wildcardTerm}"`);
    
    const result = await graphQLClient.request(
      SEARCH_PROFILES_QUERY,
      { searchTerm: wildcardTerm }
    );
    
    console.log(`GraphQL search result:`, JSON.stringify(result, null, 2));
    
    const data = result as any;
    
    if (data.Profile && Array.isArray(data.Profile)) {
      const graphqlProfiles = data.Profile.map((profile: any) => ({
        accountAddress: profile.id,
        name: profile.name || `Address ${profile.id.substring(0, 8)}...`,
        description: "LUKSO Universal Profile",
        createdAt: Math.floor(Date.now() / 1000)
      }));
      
      // Add GraphQL profiles to results
      profiles = [...profiles, ...graphqlProfiles];
    }
    
    // If no results are found, try on-chain data if the search term looks like an address
    if (profiles.length === 0 && address.startsWith("0x") && address.length >= 8) {
      try {
        const onChainProfile = await getProfileData(address);
        if (onChainProfile) {
          profiles.push({
            accountAddress: onChainProfile.address,
            name: onChainProfile.name,
            description: onChainProfile.description,
            createdAt: Math.floor(Date.now() / 1000)
          });
        }
      } catch (error) {
        console.error("Error getting on-chain profile data:", error);
      }
    }
    
    // If still no results, return a fallback message
    if (profiles.length === 0) {
      return [{
        accountAddress: "0x0000000000000000000000000000000000000000",
        name: "No results found",
        description: "Try searching with a different term or use a complete address with /query",
        createdAt: Math.floor(Date.now() / 1000)
      }];
    }
    
    return profiles;
  } catch (error) {
    console.error('Error searching Universal Profiles:', error);
    return [{
      accountAddress: "0x0000000000000000000000000000000000000000",
      name: "Search Error",
      description: `Error: ${error instanceof Error ? error.message : String(error)}`,
      createdAt: Math.floor(Date.now() / 1000)
    }];
  }
}

/**
 * Get Universal Profile by address
 */
async function getUniversalProfileByAddress(address: string): Promise<any> {
  try {
    console.log(`Getting profile for address: ${address} using on-chain data...`);
    
    // Fallback to on-chain profile data directly
    console.log(`Attempting to get on-chain profile data for ${address}`);
    const onChainProfile = await getProfileData(address);
    
    if (onChainProfile) {
      return {
        address,
        accountAddress: address,
        name: onChainProfile.name,
        description: onChainProfile.description,
        profileImage: onChainProfile.profileImage,
        createdAt: Math.floor(Date.now() / 1000)
      };
    }
    
    console.log(`No profile found for address ${address}`);
    return null;
  } catch (error) {
    console.error(`Error getting Universal Profile for address ${address}:`, error);
    return null;
  }
}

/**
 * Get assets owned by a Universal Profile
 */
async function getProfileAssets(address: string): Promise<any> {
  try {
    // Query for profile assets using the Envio API
    const assetsQuery = gql`
      query GetProfileAssets($address: String!) {
        Hold(
          where: { Profile: { address: { _ilike: $address } } },
          limit: 10
        ) {
          Token {
            address
            name
            symbol
            decimal
          }
          amount
        }
      }
    `;
    
    // Add wildcard for partial address matching
    const wildcardAddress = `%${address.toLowerCase()}%`;
    const result = await graphQLClient.request(
      assetsQuery, 
      { address: wildcardAddress }
    );
    
    const data = result as any;
    if (data.Hold && Array.isArray(data.Hold)) {
      // Map to expected format for backward compatibility
      return {
        ownedAssets: data.Hold.map((hold: any) => ({
          tokenAddress: hold.Token?.address || "",
          assetName: hold.Token?.name || "Unknown Token",
          assetSymbol: hold.Token?.symbol || "???",
          decimals: hold.Token?.decimal || 18,
          isNFT: false,
          balance: hold.amount || "0"
        })),
        issuedAssets: []
      };
    }
    return null;
  } catch (error) {
    console.error(`Error getting assets for profile ${address}:`, error);
    return null;
  }
}

/**
 * Search for owners of a specific NFT
 */
async function searchNFTOwners(nftAddress: string): Promise<any[]> {
  try {
    console.log(`Searching for owners of NFT at address: ${nftAddress}`);
    
    // Create a query for Token Holders using the Envio API
    const searchQuery = gql`
      query SearchTokenHolders($nftAddress: String!) {
        Hold(
          where: {Token: {address: {_ilike: $nftAddress}}},
          limit: 5
        ) {
          Profile {
            address
            name
          }
          Token {
            address
            name
            symbol
          }
          amount
        }
      }
    `;
    
    const result = await graphQLClient.request(
      searchQuery,
      { nftAddress: `%${nftAddress.toLowerCase()}%` }
    );
    
    console.log(`NFT search result:`, JSON.stringify(result, null, 2));
    
    const data = result as any;
    if (data.Hold && Array.isArray(data.Hold)) {
      // Map to expected format for the agent
      return data.Hold.map((hold: any) => ({
        address: hold.Profile?.address || "Unknown",
        assetAddress: nftAddress,
        balance: hold.amount || "1"
      }));
    }
    return [];
  } catch (error) {
    console.error(`Error searching NFT owners for token ${nftAddress}:`, error);
    return [];
  }
}

/**
 * Alternative method to get inbox ID from address when getUsersFromIdentifiers is not available
 */
async function getInboxIdFromAddress(client: Client, address: string): Promise<string | null> {
  try {
    // Try to create a DM with the address to get its inbox ID
    const dm = await client.conversations.newDmWithIdentifier({
      identifierKind: IdentifierKind.Ethereum,
      identifier: address,
    });
    
    if (dm && dm.peerInboxId) {
      return dm.peerInboxId;
    }
    
    return null;
  } catch (error) {
    console.warn(`Couldn't find XMTP user for address ${address}:`, error);
    return null;
  }
}

// Helper for converting addresses to inbox IDs in bulk
async function getInboxIdsFromAddresses(client: Client, addresses: string[]): Promise<string[]> {
  const inboxIds: string[] = [];
  
  for (const address of addresses) {
    const inboxId = await getInboxIdFromAddress(client, address);
    if (inboxId) {
      inboxIds.push(inboxId);
    }
  }
  
  return inboxIds;
}

/**
 * Create a new XMTP group with specified members
 */
async function createNewGroup(
  client: Client,
  name: string,
  description: string,
  memberInboxIds: string[]
): Promise<Group | null> {
  try {
    console.log(`Creating group "${name}" with ${memberInboxIds.length} members...`);
    
    // Create a new group with the agent and specified members
    const group = await client.conversations.newGroup(memberInboxIds, {
      groupName: name,
      groupDescription: description,
    });
    
    // Cache the group
    activeGroups.set(group.id, group);
    
    console.log(`Group created with ID: ${group.id}`);
    return group;
  } catch (error) {
    console.error("Error creating group:", error);
    return null;
  }
}

/**
 * Add a member to an existing group
 */
async function addMemberToGroup(
  groupId: string,
  memberInboxId: string
): Promise<boolean> {
  try {
    // Get the group from the cache
    const group = activeGroups.get(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }
    
    // Add the member to the group
    await group.addMembers([memberInboxId]);
    console.log(`Added member ${memberInboxId} to group ${groupId}`);
    return true;
  } catch (error) {
    console.error(`Error adding member to group:`, error);
    return false;
  }
}

/**
 * Remove a member from an existing group
 */
async function removeMemberFromGroup(
  groupId: string,
  memberInboxId: string
): Promise<boolean> {
  try {
    // Get the group from the cache
    const group = activeGroups.get(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }
    
    // Remove the member from the group
    await group.removeMembers([memberInboxId]);
    console.log(`Removed member ${memberInboxId} from group ${groupId}`);
    return true;
  } catch (error) {
    console.error(`Error removing member from group:`, error);
    return false;
  }
}

/**
 * List all members of a group
 */
async function listGroupMembers(groupId: string): Promise<any[]> {
  try {
    // Get the group from the cache
    const group = activeGroups.get(groupId);
    if (!group) {
      throw new Error(`Group with ID ${groupId} not found`);
    }
    
    // Get all members
    const members = await group.members();
    return members;
  } catch (error) {
    console.error(`Error listing group members:`, error);
    return [];
  }
}

/**
 * Check if a member is in a group
 */
async function isAddressInGroup(groupId: string, address: string): Promise<boolean> {
  try {
    const members = await listGroupMembers(groupId);
    
    for (const member of members) {
      // Check each member's identifiers for this address
      for (const identifier of member.accountIdentifiers) {
        if (identifier.identifier.toLowerCase() === address.toLowerCase()) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking if address is in group:`, error);
    return false;
  }
}

/**
 * Add NFT holders to a group
 */
async function addNFTHoldersToGroup(
  client: Client,
  groupId: string,
  nftAddress: string
): Promise<{ success: boolean; addedCount: number; message: string }> {
  try {
    // Get the group
    const group = activeGroups.get(groupId);
    if (!group) {
      return { 
        success: false, 
        addedCount: 0,
        message: `Group with ID ${groupId} not found`
      };
    }
    
    // Find NFT holders
    const nftHolders = await searchNFTOwners(nftAddress);
    if (nftHolders.length === 0) {
      return { 
        success: false, 
        addedCount: 0,
        message: `No holders found for NFT ${nftAddress}`
      };
    }
    
    // Get current members to avoid duplicates
    const members = await listGroupMembers(groupId);
    const currentMemberAddresses = new Set(
      members.flatMap(member => 
        member.accountIdentifiers.map(id => id.identifier.toLowerCase())
      )
    );
    
    // Track addresses we'll add
    const addressesToAdd: string[] = [];
    const inboxIdsToAdd: string[] = [];
    
    // Process each NFT holder
    for (const holder of nftHolders) {
      const address = holder.address.toLowerCase();
      
      // Skip if already a member
      if (currentMemberAddresses.has(address)) {
        continue;
      }
      
      addressesToAdd.push(address);
    }
    
    // If no new addresses to add
    if (addressesToAdd.length === 0) {
      return { 
        success: true, 
        addedCount: 0,
        message: `All NFT holders are already in the group`
      };
    }
    
    // Get inboxIds for each address (if available on XMTP)
    let addedCount = 0;
    
    for (const address of addressesToAdd) {
      try {
        // Try to find inbox ID for this address by creating a DM
        try {
          // Try to create a DM conversation with the address (this checks if user exists)
          const dm = await client.conversations.newDmWithIdentifier({
            identifierKind: IdentifierKind.Ethereum,
            identifier: address,
          });
          
          if (dm && dm.peerInboxId) {
            inboxIdsToAdd.push(dm.peerInboxId);
          }
        } catch (error) {
          console.warn(`Couldn't create DM for XMTP user at address ${address}`);
        }
      } catch (error) {
        console.warn(`Couldn't find XMTP user for address ${address}`);
      }
    }
    
    // Add members to the group
    if (inboxIdsToAdd.length > 0) {
      await group.addMembers(inboxIdsToAdd);
      addedCount = inboxIdsToAdd.length;
      
      // Save groups to cache after updating
      saveGroupsToCache();
      
      return { 
        success: true, 
        addedCount,
        message: `Added ${inboxIdsToAdd.length} NFT holders to the group`
      };
    } else {
      return { 
        success: false, 
        addedCount: 0,
        message: `Found ${addressesToAdd.length} NFT holders, but none are using XMTP`
      };
    }
    
  } catch (error) {
    console.error(`Error adding NFT holders to group:`, error);
    return { 
      success: false, 
      addedCount: 0,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Helper function to save groups to cache
function saveGroupsToCache(): void {
  try {
    const groupsCache: GroupCacheEntry[] = [];
    
    // Convert all active groups to cache entries
    for (const [id, group] of activeGroups.entries()) {
      groupsCache.push({
        id,
        name: group.name || "Unnamed Group",
        description: group.description,
        createdAt: Date.now(),
        memberCount: 0 // This will be updated when we load groups
      });
    }
    
    // Write to file
    fs.writeFileSync(
      GROUPS_CACHE_FILE, 
      JSON.stringify(groupsCache, null, 2)
    );
    
    console.log(`Saved ${groupsCache.length} groups to cache`);
  } catch (error) {
    console.error("Error saving groups to cache:", error);
  }
}

// Helper function to load groups from cache
function loadGroupsFromCache(): GroupCacheEntry[] {
  try {
    if (!fs.existsSync(GROUPS_CACHE_FILE)) {
      return [];
    }
    
    const fileContents = fs.readFileSync(GROUPS_CACHE_FILE, "utf8");
    const groupsCache = JSON.parse(fileContents) as GroupCacheEntry[];
    
    console.log(`Loaded ${groupsCache.length} groups from cache`);
    return groupsCache;
  } catch (error) {
    console.error("Error loading groups from cache:", error);
    return [];
  }
}

// Add GraphQL constants for the LUKSO network
const LUKSO_GRAPHQL_ENDPOINT = NETWORK_ID === "lukso-mainnet" 
  ? "https://api.mainnet.lukso.network/graphql"
  : "https://api.testnet.lukso.network/graphql";

// Create a GraphQL client for LUKSO API
const luksoGraphQLClient = new GraphQLClient(LUKSO_GRAPHQL_ENDPOINT);

/**
 * Get NFTs using Envio GraphQL API
 */
async function getNFTsViaGraphQL(address: string): Promise<any> {
  try {
    console.log(`Getting NFTs from GraphQL for address: ${address}`);
    
    // Query for NFTs
    const query = gql`
      query GetTokens($address: String!) {
        Hold(where: {
          Profile: {address: {_ilike: $address}},
          Token: {lsp8TokenIdFormat: {_is_null: false}}
        }, limit: 20) {
          Token {
            id
            tokenId
            formattedTokenId
            name
            lsp4TokenName
            lsp4TokenSymbol
            description
            images {
              url
            }
            icons {
              url
            }
            asset {
              address
              name
              symbol
            }
          }
        }
      }
    `;
    
    const variables = {
      address: `%${address.toLowerCase()}%`
    };
    
    // Make the GraphQL request
    const result = await luksoGraphQLClient.request(query, variables);
    
    // Type guard to check if result has the expected structure
    if (!result || typeof result !== 'object' || !('Hold' in result)) {
      console.log("Invalid GraphQL response structure");
      return null;
    }
    
    const holds = (result as any).Hold;
    
    if (!Array.isArray(holds) || holds.length === 0) {
      console.log("No NFTs found via GraphQL");
      return {
        address,
        nfts: [
          { id: "No NFTs found", name: "No NFTs found for this address", imageUrl: "" }
        ]
      };
    }
    
    console.log(`Found ${holds.length} NFTs via GraphQL`);
    
    // Process NFTs from GraphQL response
    const nfts = holds.map((hold: any) => {
      const token = hold.Token || {};
      
      // Get image URL from available sources
      let imageUrl = "";
      if (token.images && token.images.length > 0 && token.images[0].url) {
        imageUrl = token.images[0].url;
      } else if (token.icons && token.icons.length > 0 && token.icons[0].url) {
        imageUrl = token.icons[0].url;
      }
      
      // Get token ID info - handle different formats
      const tokenId = token.tokenId || token.id || "unknown";
      const formattedId = token.formattedTokenId || tokenId;
      
      // Shorten ID for display
      const shortId = typeof formattedId === 'string' ? 
        (formattedId.length > 8 ? formattedId.slice(0, 8) + '...' : formattedId) : 
        formattedId;
      
      // Get asset info
      const asset = token.asset || {};
      
      return {
        id: tokenId,
        name: token.lsp4TokenName || token.name || `Token #${shortId}`,
        description: token.description || `LUKSO NFT from ${asset.name || 'Unknown'} collection`,
        contract: asset.address || "",
        contractName: asset.name || "Unknown Collection",
        symbol: token.lsp4TokenSymbol || asset.symbol || "",
        tokenId: formattedId,
        imageUrl: imageUrl,
        collection: {
          name: asset.name || "Unknown Collection",
          symbol: asset.symbol || "",
          contractAddress: asset.address || "",
          standard: "LSP8"
        }
      };
    });
    
    return {
      address,
      nfts,
      source: "graphql"
    };
  } catch (error) {
    console.error("Error fetching NFTs from GraphQL:", error);
    return null;
  }
}

// Add Whisk GraphQL client setup
const WHISK_API_URL = "https://api.whisk.so/graphql";
const whiskGraphQLClient = new GraphQLClient(WHISK_API_URL, {
  headers: {
    Authorization: `Bearer ${process.env.WHISK_API_KEY || '79dd90e4-b3b8-45a7-a155-7abe59ec0e39'}`
  }
});

// Update Whisk query to match their schema
const WHISK_PROFILE_QUERY = gql`
  query GetProfile($address: String!) {
    identity(address: $address) {
      base {
        name
        avatar
      }
      ens {
        name
        avatar
      }
      farcaster {
        name
        avatar
      }
      lens {
        name
        avatar
      }
    }
  }
`;

// Add ENS resolution function
async function resolveENSName(name: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.ensideas.com/ens/resolve/${name}`);
    const data = await response.json();
    return data.address || null;
  } catch (error) {
    console.error("Error resolving ENS name:", error);
    return null;
  }
}