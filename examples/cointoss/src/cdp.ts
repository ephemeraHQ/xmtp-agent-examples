import {
  Coinbase,
  TimeoutError,
  Wallet,
  type Trade,
  type Transfer,
  type WalletData,
} from "@coinbase/coinbase-sdk";
import { isAddress } from "viem";
import { storage } from "./storage";
import type { AgentWalletData } from "./types";

const coinbaseApiKeyName = process.env.CDP_API_KEY_NAME;
let coinbaseApiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;
const networkId = process.env.NETWORK_ID ?? "base-sepolia";

if (!coinbaseApiKeyName || !coinbaseApiKeyPrivateKey || !networkId) {
  console.error(
    "Either networkId, CDP_API_KEY_NAME or CDP_API_KEY_PRIVATE_KEY must be set",
  );
  process.exit(1);
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

// Initialize the SDK when the module is loaded
let sdkInitialized = false;

export class WalletService {
  private senderAddress: string;

  constructor(sender: string) {
    if (!sdkInitialized) {
      sdkInitialized = initializeCoinbaseSDK();
    }

    this.senderAddress = sender.toLowerCase();
  }

  async createWallet(inboxId: string): Promise<AgentWalletData> {
    try {
      console.log(`Creating new wallet for key ${inboxId}...`);

      // Initialize SDK if not already done
      if (!sdkInitialized) {
        sdkInitialized = initializeCoinbaseSDK();
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
      console.log(`NEW WALLET CREATED FOR USER: ${inboxId}`);
      console.log(`WALLET ADDRESS: ${walletAddress}`);
      console.log(`NETWORK: ${networkId}`);
      console.log(`SEND FUNDS TO THIS ADDRESS TO TEST: ${walletAddress}`);
      console.log("-----------------------------------------------------");

      const walletInfo: AgentWalletData = {
        id: walletAddress,
        wallet: wallet,
        walletData: data,
        human_address: inboxId,
        agent_address: walletAddress,
        inboxId: inboxId,
      };

      const walletInfoToStore: AgentWalletData = {
        id: walletAddress,
        //no wallet
        walletData: data,
        human_address: inboxId,
        agent_address: walletAddress,
        inboxId: inboxId,
      };

      await storage.saveUserWallet(inboxId, JSON.stringify(walletInfoToStore));
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

  async getWallet(inboxId: string): Promise<AgentWalletData | undefined> {
    // Try to retrieve existing wallet data
    const walletData = await storage.getUserWallet(inboxId);
    if (walletData === null) {
      console.log(`No wallet found for ${inboxId}, creating new one`);
      return this.createWallet(inboxId);
    }

    const importedWallet = await Wallet.import(walletData.walletData);

    return {
      id: importedWallet.getId() ?? "",
      wallet: importedWallet,
      walletData: walletData.walletData,
      human_address: walletData.human_address,
      agent_address: walletData.agent_address,
      inboxId: walletData.inboxId,
    };
  }

  async transfer(
    userId: string,
    toAddress: string,
    amount: number,
  ): Promise<Transfer | undefined> {
    userId = userId.toLowerCase();
    toAddress = toAddress.toLowerCase();

    console.log("📤 TRANSFER INITIATED");
    console.log(`💸 Amount: ${amount} USDC`);
    console.log(`🔍 From user: ${userId}`);
    console.log(`🔍 To: ${toAddress}`);

    // Get the source wallet
    console.log(`🔑 Retrieving source wallet for user: ${userId}...`);
    const from = await this.getWallet(userId);
    if (!from) {
      console.error(`❌ No wallet found for sender: ${userId}`);
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
    const balance = await from.wallet?.getBalance(Coinbase.assets.Usdc);
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
    const to = await this.getWallet(toAddress);
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
      const transfer = await from.wallet?.createTransfer({
        amount,
        assetId: Coinbase.assets.Usdc,
        destination: destinationAddress,
        gasless: true,
      });

      console.log(`⏳ Waiting for transfer to complete...`);
      try {
        await transfer?.wait();
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

  async checkBalance(
    humanAddress: string,
  ): Promise<{ address: string | undefined; balance: number }> {
    humanAddress = humanAddress.toLowerCase();
    const walletData = await this.getWallet(humanAddress);

    if (!walletData) {
      return { address: undefined, balance: 0 };
    }

    const balance = await walletData.wallet?.getBalance(Coinbase.assets.Usdc);
    return {
      address: walletData.agent_address,
      balance: Number(balance),
    };
  }

  async swap(
    address: string,
    fromAssetId: string,
    toAssetId: string,
    amount: number,
  ): Promise<Trade | undefined> {
    address = address.toLowerCase();
    const walletData = await this.getWallet(address);
    if (!walletData) return undefined;

    const trade = await walletData.wallet?.createTrade({
      amount,
      fromAssetId,
      toAssetId,
    });

    if (!trade) return undefined;

    try {
      await trade.wait();
    } catch (err) {
      if (!(err instanceof TimeoutError)) {
        console.error("Error while waiting for trade to complete: ", err);
      }
    }

    return trade;
  }

  async deleteWallet(key: string): Promise<boolean> {
    key = key.toLowerCase();
    const encryptedKey = `wallet:${key}`;

    const emptyWallet: AgentWalletData = {
      id: "",
      wallet: {} as Wallet,
      walletData: {} as WalletData,
      human_address: encryptedKey,
      agent_address: encryptedKey,
      inboxId: encryptedKey,
    };

    await storage.saveUserWallet(encryptedKey, JSON.stringify(emptyWallet));
    return true;
  }
}
