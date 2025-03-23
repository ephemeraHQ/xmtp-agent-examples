import {
  Coinbase,
  TimeoutError,
  Wallet,
  type Trade,
  type Transfer,
} from "@coinbase/coinbase-sdk";
import { isAddress } from "viem";
import { storage } from "./storage";
import { validateEnvironment, type AgentWalletData } from "./types";

const { coinbaseApiKeyName, coinbaseApiKeyPrivateKey, networkId } =
  validateEnvironment();

// Initialize Coinbase SDK
function initializeCoinbaseSDK(): boolean {
  try {
    Coinbase.configure({
      apiKeyName: coinbaseApiKeyName,
      privateKey: coinbaseApiKeyPrivateKey,
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
  constructor() {
    if (!sdkInitialized) {
      sdkInitialized = initializeCoinbaseSDK();
    }
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

      const walletInfo: AgentWalletData = {
        id: walletAddress,
        wallet: wallet,
        walletData: data,
        agent_address: walletAddress,
        inboxId: inboxId,
      };

      await storage.saveWallet(
        inboxId,
        JSON.stringify({
          id: walletInfo.id,
          // no wallet
          walletData: walletInfo.walletData,
          agent_address: walletInfo.agent_address,
          inboxId: walletInfo.inboxId,
        }),
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

  async getWallet(inboxId: string): Promise<AgentWalletData | undefined> {
    // Try to retrieve existing wallet data
    const walletData = await storage.getWallet(inboxId);
    if (walletData === null) {
      console.log(`No wallet found for ${inboxId}, creating new one`);
      return this.createWallet(inboxId);
    }

    const importedWallet = await Wallet.import(walletData.walletData);

    return {
      id: importedWallet.getId() ?? "",
      wallet: importedWallet,
      walletData: walletData.walletData,
      agent_address: walletData.agent_address,
      inboxId: walletData.inboxId,
    };
  }

  /**
   * Check if an address belongs to a toss wallet and return the corresponding toss ID
   */
  private async getTossIdFromAddress(address: string): Promise<string | null> {
    if (!isAddress(address)) return null;

    try {
      // Look for toss games with this wallet address
      const tosses = await storage.listActiveTosses();
      const matchingToss = tosses.find(
        (toss) => toss.walletAddress.toLowerCase() === address.toLowerCase(),
      );

      if (matchingToss) {
        console.log(`📌 Address ${address} belongs to toss:${matchingToss.id}`);
        return matchingToss.id;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`ℹ️ Error checking for toss wallet: ${errorMessage}`);
    }

    return null;
  }

  async transfer(
    inboxId: string,
    toAddress: string,
    amount: number,
  ): Promise<Transfer | undefined> {
    toAddress = toAddress.toLowerCase();

    console.log("📤 TRANSFER INITIATED");
    console.log(`💸 Amount: ${amount} USDC`);
    console.log(`🔍 From user: ${inboxId}`);
    console.log(`🔍 To: ${toAddress}`);

    // Get the source wallet
    console.log(`🔑 Retrieving source wallet for user: ${inboxId}...`);
    const from = await this.getWallet(inboxId);
    if (!from) {
      console.error(`❌ No wallet found for sender: ${inboxId}`);
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

    // First check if this address belongs to a toss wallet
    const tossId = await this.getTossIdFromAddress(toAddress);
    if (tossId) {
      // Use the toss ID instead of the address
      console.log(`🎮 Found toss ID: ${tossId} for address: ${toAddress}`);
      const tossWallet = await this.getWallet(tossId);
      if (tossWallet) {
        destinationAddress = tossWallet.agent_address;
        console.log(`✅ Using toss wallet: ${destinationAddress}`);
        // Continue with the existing wallet, don't create a new one
      }
    } else {
      console.log(`ℹ️ Using raw address as destination: ${destinationAddress}`);
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
    inboxId: string,
  ): Promise<{ address: string | undefined; balance: number }> {
    // First check if this is an address that belongs to a toss wallet
    const tossId = await this.getTossIdFromAddress(inboxId);
    if (tossId) {
      // Use the toss ID instead of the address
      console.log(`🎮 Using toss ID: ${tossId} instead of address: ${inboxId}`);
      const tossWallet = await this.getWallet(tossId);
      if (tossWallet) {
        const balance = await tossWallet.wallet?.getBalance(
          Coinbase.assets.Usdc,
        );
        return {
          address: tossWallet.agent_address,
          balance: Number(balance),
        };
      }
    }

    // Normal wallet lookup
    const walletData = await this.getWallet(inboxId);

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

    // First check if this is an address that belongs to a toss wallet
    const tossId = await this.getTossIdFromAddress(address);
    if (tossId) {
      // Use the toss ID instead of the address
      console.log(`🎮 Using toss ID: ${tossId} instead of address: ${address}`);
      const tossWallet = await this.getWallet(tossId);
      if (tossWallet) {
        const trade = await tossWallet.wallet?.createTrade({
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
    }

    // Normal wallet lookup
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
}
