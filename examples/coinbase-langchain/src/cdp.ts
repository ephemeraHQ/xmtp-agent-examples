import {
  Coinbase,
  TimeoutError,
  Wallet,
  type Transfer,
  type WalletData,
} from "@coinbase/coinbase-sdk";
import { isAddress } from "viem";
import { getWalletData, saveWalletData } from "./storage";
import type { XMTPUser } from "./types";

const coinbaseApiKeyName = process.env.CDP_API_KEY_NAME;
let coinbaseApiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;
const networkId = process.env.NETWORK_ID ?? "base-sepolia";

if (!coinbaseApiKeyName || !coinbaseApiKeyPrivateKey || !networkId) {
  console.error(
    "Either networkId, CDP_API_KEY_NAME or CDP_API_KEY_PRIVATE_KEY must be set",
  );
  process.exit(1);
}

class WalletStorage {
  async get(inboxId: string): Promise<string | undefined> {
    try {
      const data = await getWalletData(inboxId, networkId);
      return data ?? undefined;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error getting wallet data for ${inboxId}:`, errorMessage);
      return undefined;
    }
  }

  async set(inboxId: string, value: string): Promise<void> {
    try {
      await saveWalletData(inboxId, value, networkId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error saving wallet data for ${inboxId}:`, errorMessage);
    }
  }

  async del(inboxId: string): Promise<void> {
    try {
      await saveWalletData(inboxId, "", networkId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Error deleting wallet data for ${inboxId}:`, errorMessage);
    }
  }
}

// Initialize Coinbase SDK
function initializeCoinbaseSDK(): boolean {
  // Replace \\n with actual newlines if present in the private key
  if (coinbaseApiKeyPrivateKey) {
    coinbaseApiKeyPrivateKey = coinbaseApiKeyPrivateKey.replace(/\\n/g, "\n");
  }
  try {
    Coinbase.configure({
      apiKeyName: coinbaseApiKeyName as string,
      privateKey: coinbaseApiKeyPrivateKey as string,
    });
    console.log("Coinbase SDK initialized successfully, network:", networkId);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to initialize Coinbase SDK:", errorMessage);
    return false;
  }
}

// Agent wallet data
export type AgentWalletData = {
  id: string;
  wallet: Wallet;
  data: WalletData;
  human_address: string;
  agent_address: string;
  blockchain?: string;
  state?: string;
  inboxId: string;
};

// Wallet service class based on cointoss implementation
export class WalletService {
  private walletStorage: WalletStorage;
  private humanAddress: string;
  private inboxId: string;
  private sdkInitialized: boolean;

  constructor(xmtpUser: XMTPUser) {
    this.sdkInitialized = initializeCoinbaseSDK();
    this.walletStorage = new WalletStorage();
    this.humanAddress = xmtpUser.address;
    this.inboxId = xmtpUser.inboxId;
    console.log(
      "WalletService initialized with sender address",
      this.humanAddress,
      "and inboxId",
      this.inboxId,
    );
  }

  async createWallet(): Promise<AgentWalletData> {
    try {
      console.log(`Creating new wallet for key ${this.inboxId}...`);

      // Initialize SDK if not already done
      if (!this.sdkInitialized) {
        this.sdkInitialized = initializeCoinbaseSDK();
      }

      // Log the network we're using
      console.log(`Creating wallet on network: ${networkId}`);

      // Create wallet
      const wallet = await Wallet.create({
        networkId: networkId,
      }).catch((err: unknown) => {
        const errorDetails =
          typeof err === "object" ? JSON.stringify(err, null, 2) : err;
        console.error("Detailed wallet creation error:", errorDetails);
        throw err;
      });

      console.log("Wallet created successfully, exporting data...");
      const data = wallet.export();

      console.log("Getting default address...");
      const address = await wallet.getDefaultAddress();
      const walletAddress = address.getId();

      // Make the wallet address visible in the logs for funding
      console.log("-----------------------------------------------------");
      console.log(`NEW WALLET CREATED FOR USER: ${this.humanAddress}`);
      console.log(`WALLET ADDRESS: ${walletAddress}`);
      console.log(`NETWORK: ${networkId}`);
      console.log(`SEND FUNDS TO THIS ADDRESS TO TEST: ${walletAddress}`);
      console.log("-----------------------------------------------------");

      const walletInfo: AgentWalletData = {
        id: walletAddress,
        wallet: wallet,
        data: data,
        human_address: this.humanAddress,
        agent_address: walletAddress,
        inboxId: this.inboxId,
      };

      console.log("Saving wallet data to storage...");
      const walletInfoToStore = {
        data: data,
        human_address: this.humanAddress,
        agent_address: walletAddress,
        inboxId: this.inboxId,
      };
      await this.walletStorage.set(
        this.inboxId,
        JSON.stringify(walletInfoToStore),
      );

      console.log("Wallet created and saved successfully");
      return walletInfo;
    } catch (error: unknown) {
      console.error("Failed to create wallet:", error);

      // Provide more detailed error information
      if (error instanceof Error) {
        throw new Error(`Wallet creation failed: ${error.message}`);
      }

      throw new Error(`Failed to create wallet: ${String(error)}`);
    }
  }

  async getWallet(
    inboxId: string,
    createIfNotFound: boolean = true,
  ): Promise<AgentWalletData | undefined> {
    console.log("Getting wallet for:", inboxId);
    const walletData = await this.walletStorage.get(inboxId);

    // If no wallet exists, create one
    if (!walletData) {
      console.log("No wallet found for", inboxId);
      if (createIfNotFound) {
        console.log("Creating new wallet as none was found");
        try {
          const wallet = await this.createWallet();
          console.log("Successfully created new wallet, returning wallet data");
          return wallet;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Failed to create wallet in getWallet:", errorMessage);
          throw error;
        }
      }
      return undefined;
    }

    try {
      console.log("Found existing wallet data, decrypting...");
      const walletInfo = JSON.parse(walletData) as AgentWalletData;

      console.log("Importing wallet from stored data...");
      const importedWallet = await Wallet.import(walletInfo.data).catch(
        (err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error("Error importing wallet:", errorMessage);
          throw new Error(`Failed to import wallet: ${errorMessage}`);
        },
      );

      console.log("Wallet imported successfully");
      return {
        id: importedWallet.getId() ?? "",
        wallet: importedWallet,
        data: walletInfo.data,
        human_address: walletInfo.human_address,
        agent_address: walletInfo.agent_address,
        inboxId: walletInfo.inboxId,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to decrypt or import wallet data:", errorMessage);

      // If we failed to import, but have wallet data, attempt to recreate
      if (createIfNotFound) {
        console.log("Attempting to recreate wallet after import failure");
        return this.createWallet();
      }

      throw new Error("Invalid wallet access");
    }
  }

  async checkBalance(
    inboxId: string,
  ): Promise<{ address: string | undefined; balance: number }> {
    console.log(`⚖️ Checking balance for user with inboxId: ${inboxId}...`);

    const walletData = await this.getWallet(inboxId);
    if (!walletData) {
      console.log(`❌ No wallet found for user with inboxId: ${inboxId}`);
      return { address: undefined, balance: 0 };
    }

    console.log(
      `✅ Retrieved wallet with address: ${walletData.agent_address} for user with inboxId: ${inboxId}`,
    );

    try {
      console.log(
        `💰 Fetching USDC balance for address: ${walletData.agent_address}...`,
      );
      const balance = await walletData.wallet.getBalance(Coinbase.assets.Usdc);
      console.log(
        `💵 USDC Balance for user with inboxId: ${inboxId}: ${Number(balance)} USDC`,
      );
      console.log(Coinbase.assets.Usdc);

      return {
        address: walletData.agent_address,
        balance: Number(balance),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `❌ Error getting balance for user with inboxId: ${inboxId}:`,
        errorMessage,
      );
      return {
        address: walletData.agent_address,
        balance: 0,
      };
    }
  }

  async transfer(
    inboxId: string,
    humanAddress: string,
    toAddress: string,
    amount: number,
  ): Promise<Transfer | undefined> {
    humanAddress = humanAddress.toLowerCase();
    toAddress = toAddress.toLowerCase();

    console.log("📤 TRANSFER INITIATED");
    console.log(`💸 Amount: ${amount} USDC`);
    console.log(`🔍 From user: ${humanAddress}`);
    console.log(`🔍 To: ${toAddress}`);

    // Get the source wallet
    console.log(`🔑 Retrieving source wallet for user: ${humanAddress}...`);
    const from = await this.getWallet(inboxId);
    if (!from) {
      console.error(`❌ No wallet found for sender: ${humanAddress}`);
      return undefined;
    }
    console.log(`✅ Source wallet found: ${from.agent_address}`);

    if (!Number(amount)) {
      console.error(`❌ Invalid amount: ${amount}`);
      return undefined;
    }

    // Check balance
    console.log(
      `💰 Checking balance for source wallet: ${from.agent_address}...`,
    );
    const balance = await from.wallet.getBalance(Coinbase.assets.Usdc);
    console.log(`💵 Available balance: ${Number(balance)} USDC`);

    if (Number(balance) < amount) {
      console.error(
        `❌ Insufficient balance. Required: ${amount} USDC, Available: ${Number(balance)} USDC`,
      );
      return undefined;
    }

    if (!isAddress(toAddress) && !toAddress.includes(":")) {
      // If this is not an address, and not a user ID, we can't transfer
      console.error(`❌ Invalid destination address: ${toAddress}`);
      return undefined;
    }

    // Get or validate destination wallet
    let destinationAddress = toAddress;
    console.log(`🔑 Validating destination: ${toAddress}...`);
    const to = await this.getWallet(toAddress, false);
    if (to) {
      destinationAddress = to.agent_address;
      console.log(`✅ Destination wallet found: ${destinationAddress}`);
    } else {
      console.log(`ℹ️ Using raw address as destination: ${destinationAddress}`);
    }

    if (destinationAddress.includes(":")) {
      console.error(
        `❌ Invalid destination address format: ${destinationAddress}`,
      );
      return undefined;
    }

    try {
      console.log(
        `🚀 Executing transfer of ${amount} USDC from ${from.agent_address} to ${destinationAddress}...`,
      );
      const transfer = await from.wallet.createTransfer({
        amount,
        assetId: Coinbase.assets.Usdc,
        destination: destinationAddress,
        gasless: true,
      });

      console.log(`⏳ Waiting for transfer to complete...`);
      try {
        await transfer.wait();
        console.log(`✅ Transfer completed successfully!`);
        console.log(
          `📝 Transaction details: ${JSON.stringify(transfer, null, 2)}`,
        );
      } catch (err) {
        if (err instanceof TimeoutError) {
          console.log(
            `⚠️ Waiting for transfer timed out, but transaction may still complete`,
          );
        } else {
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(
            `❌ Error while waiting for transfer to complete:`,
            errorMessage,
          );
        }
      }

      return transfer;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Transfer failed:`, errorMessage);
      throw error;
    }
  }
}
