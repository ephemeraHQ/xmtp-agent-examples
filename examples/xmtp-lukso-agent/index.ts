import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
  getDbPath,
} from "@helpers/client";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
} from "@xmtp/content-type-wallet-send-calls";
import { Client, type LogLevel, type XmtpEnv, Group } from "@xmtp/node-sdk";
import { ethers } from "ethers";
import OpenAI from "openai";
import { GraphQLClient, gql } from 'graphql-request';
import fetch from 'cross-fetch';

// Get environment variables
const {
  WALLET_KEY,
  ENCRYPTION_KEY,
  XMTP_ENV,
  OPENAI_API_KEY,
  LOGGING_LEVEL = "info",
  NETWORK_ID = "lukso-testnet",
} = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
  "OPENAI_API_KEY", // Required for AI responses
]);

// Initialize OpenAI client if API key is provided
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// LUKSO blockchain constants
const LUKSO_RPC_MAINNET = "https://rpc.lukso.gateway.fm";
const LUKSO_RPC_TESTNET = "https://rpc.testnet.lukso.gateway.fm";

// For this implementation, we'll use the testnet
const LUKSO_RPC = LUKSO_RPC_TESTNET;

// Initialize JSON-RPC provider
const provider = new ethers.JsonRpcProvider(LUKSO_RPC);

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

// Helper function to pause execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const amountInWei = (amount * Math.pow(10, 18)).toString();
    
    return {
      version: "1.0",
      from: fromAddress as `0x${string}`,
      chainId: this.networkId === "lukso-mainnet" ? "0x2A" as `0x${string}` : "0x42" as `0x${string}`, // 42 for testnet, 2A for mainnet
      calls: [
        {
          to: recipientAddress as `0x${string}`,
          value: amountInWei,
          data: "0x" as `0x${string}`, // Empty data for native transfers
          metadata: {
            description: `Transfer ${amount} LYX on LUKSO ${this.networkId === "lukso-mainnet" ? "Mainnet" : "Testnet"}`,
            transactionType: "transfer",
            currency: "LYX",
            amount: amount * Math.pow(10, 18),
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
 * Get transaction history
 */
async function getTransactionHistory(address: string): Promise<any> {
  try {
    // Get transaction history
    const history = await provider.getHistory(address);
    
    const transactions = history.slice(0, 5).map((tx: ethers.TransactionResponse) => {
      const isSender = tx.from.toLowerCase() === address.toLowerCase();
      const direction = isSender ? "send" : "receive";
      const value = ethers.formatEther(tx.value || 0n);
      
      // Format the timestamp
      const timestamp = new Date().toISOString().split("T")[0]; // Fallback
      
      return {
        hash: tx.hash,
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
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      address,
      transactions: [
        { hash: "Error", type: "error", value: "Error", timestamp: "Error" }
      ]
    };
  }
}

/**
 * Get NFTs for address
 */
async function getNFTs(address: string): Promise<any> {
  try {
    // Create contract instance for the Universal Profile
    const profileContract = new ethers.Contract(address, erc725yAbi, provider);
    const nfts: any[] = [];
    
    try {
      // 1. Check LSP12 Issued Assets (tokens created by this profile)
      const [issuedAssetsData] = await profileContract.getData([LSP12_ISSUED_ASSETS_KEY]);
      const issuedAssets = decodeAssetsArray(issuedAssetsData);
      
      // 2. Check LSP5 Received Assets (tokens owned by this profile)
      const [receivedAssetsData] = await profileContract.getData([LSP5_RECEIVED_ASSETS_KEY]);
      const receivedAssets = decodeAssetsArray(receivedAssetsData);
      
      // Combine unique assets from both lists
      const allAssets = [...new Set([...issuedAssets, ...receivedAssets])];
      
      // Process each asset to determine if it's an LSP8 NFT
      for (const assetAddress of allAssets) {
        try {
          // Try to interact with it as an LSP8 contract
          const assetContract = new ethers.Contract(assetAddress, lsp8Abi, provider);
          
          // Check if this address owns any tokens from this contract
          const balance = await assetContract.balanceOf(address);
          
          if (balance > 0n) {
            // Get basic contract metadata
            const [name, symbol] = await Promise.all([
              assetContract.name().catch(() => "Unknown NFT"),
              assetContract.symbol().catch(() => "NFT")
            ]);
            
            // Get token IDs owned by this address
            const tokenIds = await assetContract.tokenIdsOf(address).catch(() => []);
            
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
              const tokenId = tokenIds[i];
              
              // Get the token owner to verify ownership
              const tokenOwner = await assetContract.tokenOwnerOf(tokenId).catch(() => "");
              
              // Skip if the token is not owned by this address anymore
              if (tokenOwner.toLowerCase() !== address.toLowerCase()) {
                continue;
              }
              
              // Try to get token metadata using LSP8's tokenURI
              let tokenUri = "";
              let imageUrl = "";
              let metadata = null;
              
              try {
                tokenUri = await assetContract.tokenURI(tokenId);
                
                // If the URI is IPFS based, format it for HTTP gateway access
                if (tokenUri.startsWith("ipfs://")) {
                  const ipfsHash = tokenUri.replace("ipfs://", "");
                  // Use a public IPFS gateway
                  const ipfsGatewayUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
                  
                  // We don't actually fetch the data here to avoid external dependencies
                  // but in a real implementation we would fetch and parse the JSON
                  metadata = {
                    name: `${name} #${tokenId.slice(0, 8)}`,
                    description: "LUKSO NFT",
                    image: ipfsGatewayUrl
                  };
                  
                  imageUrl = ipfsGatewayUrl;
                } else if (tokenUri.startsWith("http")) {
                  // For HTTP URIs, we could fetch the metadata directly
                  // but for simplicity we just use the URI as is
                  imageUrl = tokenUri;
                  metadata = {
                    name: `${name} #${tokenId.slice(0, 8)}`,
                    description: "LUKSO NFT",
                    image: tokenUri
                  };
                }
              } catch (error) {
                console.error(`Error getting token URI for ${assetAddress} token ${tokenId}:`, error);
              }
              
              // Try to get additional metadata from the LSP8 contract directly
              try {
                // In LSP8, additional metadata might be stored directly on the token
                // using specific ERC725Y data keys for each token
                // This would be the proper implementation for LSP8 metadata
                // but is simplified here
              } catch (error) {
                console.error(`Error getting additional metadata for ${assetAddress} token ${tokenId}:`, error);
              }
              
              nfts.push({
                id: tokenId,
                name: metadata?.name || `${name} #${tokenId.slice(0, 8)}`,
                description: metadata?.description || `Token from ${name} collection`,
                contract: assetAddress,
                contractName: name,
                symbol: symbol,
                tokenId: tokenId,
                imageUrl: imageUrl,
                tokenUri: tokenUri,
                isIssued: issuedAssets.includes(assetAddress),
                collection: collectionData
              });
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
      return getNFTs(address);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/**
 * Get AI response from OpenAI
 */
async function getAIResponse(message: string): Promise<string> {
  try {
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
        `${index + 1}. ${profile.name || "Unnamed"} - ${profile.accountAddress}\n   ${profile.description || "No description"}`
      ).join("\n\n");
      
      return { 
        text: `Found ${profiles.length} Universal Profiles matching "${searchTerm}":\n\n${profilesList}\n\nUse /query <address> to get more details about a profile.` 
      };
    } catch (error) {
      console.error("Error searching profiles:", error);
      return { text: "Error searching for Universal Profiles. Please try again." };
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
      // Get profile from subgraph
      const profile = await getUniversalProfileByAddress(address);
      
      if (!profile) {
        // Fall back to on-chain lookup
        const onChainProfile = await getProfileData(address);
        return { 
          text: `Universal Profile (on-chain) for ${address}:\nName: ${onChainProfile.name}\nDescription: ${onChainProfile.description}` 
        };
      }
      
      // Get additional data
      const assets = await getProfileAssets(address);
      
      let assetsText = "";
      if (assets) {
        const ownedCount = assets.ownedAssets?.length || 0;
        const issuedCount = assets.issuedAssets?.length || 0;
        
        assetsText = `\nOwned Assets: ${ownedCount}\nIssued Assets: ${issuedCount}`;
      }
      
      return { 
        text: `Universal Profile for ${profile.accountAddress}:\nName: ${profile.name || "Unnamed"}\nDescription: ${profile.description || "No description"}\nCreated: ${new Date(parseInt(profile.createdAt) * 1000).toLocaleDateString()}${assetsText}\n\nYou can run regular commands like tokens/nfts/profile with this address.` 
      };
    } catch (error) {
      console.error("Error querying profile:", error);
      return { text: "Error retrieving Universal Profile details. Please try again." };
    }
  } else if (command === "/creategroup") {
    // Create a new group
    if (args.length < 2) {
      return { text: "Please provide a group name and at least one address. Usage: /creategroup <name> <address1> [address2...]" };
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
      const inboxIds = [];
      
      for (const address of validAddresses) {
        try {
          const inboxStates = await client.getUsersFromIdentifiers([{
            identifierKind: 0, // Ethereum address type
            identifier: address
          }]);
          
          if (inboxStates.length > 0 && inboxStates[0].inboxId) {
            inboxIds.push(inboxStates[0].inboxId);
          }
        } catch (error) {
          console.warn(`Couldn't find XMTP user for address ${address}`);
        }
      }
      
      if (inboxIds.length === 0) {
        return { text: "None of the provided addresses are registered on XMTP. Group creation requires at least one XMTP user." };
      }
      
      // Create the group including the sender
      const senderInboxStates = await client.preferences.inboxStateFromInboxIds([conversation.peerInboxId]);
      if (senderInboxStates.length > 0) {
        const senderInboxId = conversation.peerInboxId;
        if (!inboxIds.includes(senderInboxId)) {
          inboxIds.push(senderInboxId);
        }
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
      // Get inbox ID for the address
      const inboxStates = await client.getUsersFromIdentifiers([{
        identifierKind: 0, // Ethereum address type
        identifier: address
      }]);
      
      if (inboxStates.length === 0 || !inboxStates[0].inboxId) {
        return { text: `Address ${address} is not registered on XMTP.` };
      }
      
      const inboxId = inboxStates[0].inboxId;
      
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
      // Get inbox ID for the address
      const inboxStates = await client.getUsersFromIdentifiers([{
        identifierKind: 0, // Ethereum address type
        identifier: address
      }]);
      
      if (inboxStates.length === 0 || !inboxStates[0].inboxId) {
        return { text: `Address ${address} is not registered on XMTP.` };
      }
      
      const inboxId = inboxStates[0].inboxId;
      
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
  } else if (command.startsWith("/tx ")) {
    const amount = parseFloat(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return { text: "Please provide a valid amount. Usage: /tx <amount>" };
    }

    // Convert amount to LYX decimals (18 decimal places)
    const amountInDecimals = Math.floor(amount * Math.pow(10, 18));
    
    const walletSendCalls = lyxHandler.createLYXTransferCalls(
      senderAddress,
      agentAddress,
      amount // Pass the human-readable amount, conversion handled in createLYXTransferCalls
    );
    
    return { 
      content: walletSendCalls, 
      contentType: ContentTypeWalletSendCalls 
    };
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
- /tx <amount> - Send LYX to the agent

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
    const signer = createSigner(WALLET_KEY);
    const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
    
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

// GraphQL endpoint for LUKSO mainnet
const LUKSO_SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/lukso-network/universal-profiles-mainnet";

// Initialize GraphQL client
const graphQLClient = new GraphQLClient(LUKSO_SUBGRAPH_URL, {
  fetch // Use cross-fetch for Node.js environments
});

// GraphQL query to search Universal Profiles by name
const SEARCH_PROFILES_QUERY = gql`
  query SearchProfiles($searchTerm: String!, $limit: Int!) {
    universalProfiles(
      where: { name_contains_nocase: $searchTerm }
      orderBy: createdAt
      orderDirection: desc
      first: $limit
    ) {
      id
      name
      description
      accountAddress
      createdAt
      lastUpdatedAt
      isValid
    }
  }
`;

// GraphQL query to get profile by address
const GET_PROFILE_BY_ADDRESS_QUERY = gql`
  query GetProfileByAddress($address: String!) {
    universalProfiles(
      where: { accountAddress: $address }
    ) {
      id
      name
      description
      accountAddress
      createdAt
      lastUpdatedAt
      isValid
    }
  }
`;

// GraphQL query to get profile's assets
const GET_PROFILE_ASSETS_QUERY = gql`
  query GetProfileAssets($address: String!) {
    universalProfile(id: $address) {
      ownedAssets {
        tokenAddress
        assetName
        assetSymbol
        balance
        decimals
        isNFT
      }
      issuedAssets {
        tokenAddress
        assetName
        assetSymbol
        totalSupply
        decimals
        isNFT
      }
    }
  }
`;

// GraphQL query to search for NFT owners
const SEARCH_NFT_OWNERS_QUERY = gql`
  query SearchNFTOwners($nftAddress: String!) {
    digitalAssetOwners(
      where: { tokenAddress: $nftAddress }
      orderBy: balance
      orderDirection: desc
      first: 10
    ) {
      ownerAddress
      tokenAddress
      balance
    }
  }
`;

/**
 * Search for Universal Profiles by name
 */
async function searchUniversalProfiles(searchTerm: string, limit: number = 5): Promise<any[]> {
  try {
    const { universalProfiles } = await graphQLClient.request(
      SEARCH_PROFILES_QUERY,
      { searchTerm, limit }
    );
    
    return universalProfiles || [];
  } catch (error) {
    console.error('Error searching Universal Profiles:', error);
    return [];
  }
}

/**
 * Get Universal Profile by address
 */
async function getUniversalProfileByAddress(address: string): Promise<any> {
  try {
    const { universalProfiles } = await graphQLClient.request(
      GET_PROFILE_BY_ADDRESS_QUERY, 
      { address: address.toLowerCase() }
    );
    
    return universalProfiles && universalProfiles.length > 0 ? universalProfiles[0] : null;
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
    const data = await graphQLClient.request(
      GET_PROFILE_ASSETS_QUERY, 
      { address: address.toLowerCase() }
    );
    
    return data.universalProfile || null;
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
    const { digitalAssetOwners } = await graphQLClient.request(
      SEARCH_NFT_OWNERS_QUERY,
      { nftAddress: nftAddress.toLowerCase() }
    );
    
    return digitalAssetOwners || [];
  } catch (error) {
    console.error(`Error searching NFT owners for token ${nftAddress}:`, error);
    return [];
  }
}

// Track active groups created by the agent (in-memory cache)
const activeGroups: Map<string, Group> = new Map();

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
      const address = holder.ownerAddress.toLowerCase();
      
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
    // This step requires searching through XMTP's identifier mapping
    // Instead, let's use the getInboxStatesByAddress method
    const addedCount = 0;
    
    for (const address of addressesToAdd) {
      try {
        // Try to find inbox ID for this address using invitation
        const inboxStates = await client.getUsersFromIdentifiers([{
          identifierKind: 0, // Ethereum address type 
          identifier: address
        }]);
        
        if (inboxStates.length > 0 && inboxStates[0].inboxId) {
          const inboxId = inboxStates[0].inboxId;
          inboxIdsToAdd.push(inboxId);
        }
      } catch (error) {
        console.warn(`Couldn't find XMTP user for address ${address}`);
      }
    }
    
    // Add members to the group
    if (inboxIdsToAdd.length > 0) {
      await group.addMembers(inboxIdsToAdd);
      
      return { 
        success: true, 
        addedCount: inboxIdsToAdd.length,
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