import fs from "fs";
import { SmartWalletClient } from "@coinbase/coinbase-sdk";
import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import { validateEnvironment } from "@utils";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { ethers } from "ethers";

// Get the required environment variables
const {
  XMTP_ENV = "dev",
  ENCRYPTION_KEY,
  COINBASE_APP_ID,
  COINBASE_API_KEY,
  CDP_ENVIRONMENT = "testnet", // or "mainnet"
} = validateEnvironment([
  "ENCRYPTION_KEY",
  "COINBASE_APP_ID",
  "COINBASE_API_KEY",
]);

interface SmartWalletData {
  privateKey: string;
  smartWalletAddress: string;
  walletId: string;
  networkId: string;
}

interface CoinbaseWallet {
  privateKey: string;
  address: string;
  id: string;
}

interface CoinbaseWalletClient {
  createWallet: () => Promise<CoinbaseWallet>;
  importWallet: (privateKey: string) => Promise<void>;
  getBalance: () => Promise<bigint>;
}

interface CoinbaseWalletConfig {
  appId: string;
  apiKey: string;
  network: string;
  environment: string;
}

/**
 * Creates a new Coinbase wallet client
 * @param config - The wallet configuration
 * @returns A new Coinbase wallet client
 */
function createCoinbaseWalletClient(
  config: CoinbaseWalletConfig,
): CoinbaseWalletClient {
  const client = new SmartWalletClient(
    config,
  ) as unknown as CoinbaseWalletClient;
  return client;
}

/**
 * Generates a new Smart Contract Wallet using Coinbase SDK
 * @param {string} networkId - Network identifier (e.g., 'base-sepolia', 'base-mainnet')
 * @returns {Promise<SmartWalletData>} - The generated wallet data
 */
async function generateCoinbaseSCW(
  networkId: string,
): Promise<SmartWalletData> {
  console.log(`Generating new smart wallet on ${networkId}...`);

  // Initialize the Smart Wallet Client from Coinbase SDK
  const smartWalletClient = createCoinbaseWalletClient({
    appId: COINBASE_APP_ID,
    apiKey: COINBASE_API_KEY,
    network: networkId,
    environment: CDP_ENVIRONMENT,
  });

  // Generate a new wallet using the Coinbase SDK
  const wallet = await smartWalletClient.createWallet();

  // Extract relevant wallet details
  const walletData: SmartWalletData = {
    privateKey: wallet.privateKey,
    smartWalletAddress: wallet.address,
    walletId: wallet.id,
    networkId: networkId,
  };

  // Save wallet data to file
  try {
    const data = JSON.stringify(walletData, null, 2);
    fs.writeFileSync("wallet.json", data);
    console.log(`Wallet data saved to wallet.json`);
  } catch (error: unknown) {
    console.error("Error saving wallet data:", error);
    throw error;
  }

  return walletData;
}

/**
 * Loads wallet data from a JSON file
 * @param {string} filePath - Path to load the wallet data from
 * @returns {SmartWalletData|null} - The loaded wallet data or null if file doesn't exist
 */
function loadWalletData(filePath = "wallet.json"): SmartWalletData | null {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data) as SmartWalletData;
    }
    return null;
  } catch (error: unknown) {
    console.error("Error loading wallet data:", error);
    return null;
  }
}

/**
 * Logs agent details
 * @param {string} address - Wallet address
 * @param {string} inboxId - XMTP inbox ID
 * @param {string} environment - XMTP environment
 */
function logAgentDetails(
  address: string,
  inboxId: string,
  environment: string,
): void {
  console.log("\nAgent Details:");
  console.log(`- Address: ${address}`);
  console.log(`- XMTP Inbox ID: ${inboxId}`);
  console.log(`- Environment: ${environment}\n`);
}

/**
 * Initialize the Coinbase SDK wallet client
 * @param {SmartWalletData} walletData - The wallet data
 * @returns {Promise<CoinbaseWalletClient>} - Initialized Smart Wallet Client
 */
async function initializeSmartWalletClient(
  walletData: SmartWalletData,
): Promise<CoinbaseWalletClient> {
  // Initialize the Smart Wallet Client with the existing wallet
  const smartWalletClient = createCoinbaseWalletClient({
    appId: COINBASE_APP_ID,
    apiKey: COINBASE_API_KEY,
    network: walletData.networkId,
    environment: CDP_ENVIRONMENT,
  });

  // Import the existing wallet
  await smartWalletClient.importWallet(walletData.privateKey);

  return smartWalletClient;
}

/**
 * Main function to create and use the XMTP-enabled Coinbase CDP Smart Wallet
 */
async function main(): Promise<void> {
  console.log(`Creating Smart Wallet with XMTP integration...`);

  // Generate a new SCW or load existing one
  let walletData = loadWalletData();
  if (!walletData) {
    console.log("No existing wallet found, generating new wallet...");
    walletData = await generateCoinbaseSCW("base-sepolia");
  }

  // Initialize the Smart Wallet Client with the wallet data
  const smartWalletClient = await initializeSmartWalletClient(walletData);
  console.log(
    `Smart wallet initialized with address: ${walletData.smartWalletAddress}`,
  );

  // Get the wallet balance
  const balance = await smartWalletClient.getBalance();
  console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);

  // Get the encryption key
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Create the signer using ethers
  const signer = createSigner(walletData.privateKey);

  console.log(`Creating XMTP client on the '${XMTP_ENV}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
  });

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  logAgentDetails(address, client.inboxId, XMTP_ENV);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    // Skip messages sent by this client
    if (message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    // Process only text messages
    if (message?.contentType?.typeId !== "text") {
      continue;
    }

    console.log(
      `Received message from ${message.senderInboxId}: ${message.content}`,
    );

    // Get the conversation to reply to
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Could not find conversation, skipping message");
      continue;
    }

    // Use the smart wallet client to perform CDP-specific operations if needed
    // For example, you could check the sender's on-chain data or deploy a contract

    console.log(`Sending "gm" response to ${message.senderInboxId}...`);
    await conversation.send("gm");

    console.log("Waiting for more messages...");
  }
}

// Run the main function
main().catch((error: unknown) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});

// Export functions for use in other modules
export {
  generateCoinbaseSCW,
  loadWalletData,
  createSigner,
  getEncryptionKeyFromHex,
  initializeSmartWalletClient,
};
