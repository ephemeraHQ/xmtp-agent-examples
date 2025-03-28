import * as fs from "fs/promises";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import { WalletService } from "./cdp";
import { parseNaturalLanguageToss } from "./langchain";
import { storage } from "./storage";
import { TossStatus, type AgentConfig, type CoinTossGame } from "./types";

// Interface for transfer response
interface Transfer {
  model?: {
    sponsored_send?: {
      transaction_link?: string;
    };
  };
}

export class TossManager {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async getBalance(
    inboxId: string,
  ): Promise<{ address: string | undefined; balance: number }> {
    try {
      const balance = await this.walletService.checkBalance(inboxId);
      return { address: balance.address, balance: balance.balance };
    } catch (error) {
      console.error("Error getting user balance:", error);
      return { address: undefined, balance: 0 };
    }
  }

  // Get a player's wallet address from their user ID
  async getPlayerWalletAddress(inboxId: string): Promise<string | undefined> {
    try {
      const walletData = await this.walletService.getWallet(inboxId);
      return walletData?.agent_address;
    } catch (error) {
      console.error(`Error getting wallet address for ${inboxId}:`, error);
      return undefined;
    }
  }

  async createGame(creator: string, tossAmount: string): Promise<CoinTossGame> {
    console.log(`🎮 CREATING NEW TOSS`);
    console.log(`👤 Creator: ${creator}`);
    console.log(`💰 Toss Amount: ${tossAmount} USDC`);

    // Create a new wallet for this toss
    console.log(`🔑 Creating wallet for the toss...`);

    // Get the total count of tosses (including completed/cancelled) for debugging
    const lastIdToss = await this.getLastIdToss();
    const tossId = (lastIdToss + 1).toString();
    console.log(`🆔 Generated Toss ID: ${tossId}`);

    const tossWallet = await this.walletService.createWallet(tossId);
    console.log(`✅ Toss wallet created: ${tossWallet.agent_address}`);

    const toss: CoinTossGame = {
      id: tossId,
      creator,
      tossAmount,
      status: TossStatus.CREATED,
      participants: [], // Creator will join separately
      participantOptions: [], // Track participant options
      walletAddress: tossWallet.agent_address,
      createdAt: Date.now(),
      tossResult: "",
      paymentSuccess: false,
    };

    console.log(`💾 Saving toss to storage...`);
    await storage.saveToss(toss);
    console.log(`🎮 Toss created successfully!`);
    console.log(`---------------------------------------------`);
    console.log(`TOSS ID: ${tossId}`);
    console.log(`TOSS WALLET: ${tossWallet.agent_address}`);
    console.log(`TOSS AMOUNT: ${tossAmount} USDC`);
    console.log(`STATUS: ${toss.status}`);
    console.log(`---------------------------------------------`);

    // No longer automatically adding creator as first participant

    // Reload the toss to get updated state
    const updatedToss = await storage.getToss(tossId);
    return updatedToss || toss;
  }

  async addPlayerToGame(
    tossId: string,
    player: string,
    chosenOption: string,
    hasPaid: boolean,
  ): Promise<CoinTossGame> {
    const toss = await storage.getToss(tossId);
    if (!toss) {
      throw new Error("Toss not found");
    }

    if (
      toss.status !== TossStatus.CREATED &&
      toss.status !== TossStatus.WAITING_FOR_PLAYER
    ) {
      throw new Error("Toss is not accepting players");
    }

    if (toss.participants.includes(player)) {
      throw new Error("You are already in this toss");
    }

    if (!hasPaid) {
      throw new Error(`Please pay ${toss.tossAmount} USDC to join the toss`);
    }

    // Validate the chosen option against available options
    if (toss.tossOptions && toss.tossOptions.length > 0) {
      const normalizedOption = chosenOption.toLowerCase();
      const normalizedAvailableOptions = toss.tossOptions.map((opt) =>
        opt.toLowerCase(),
      );

      if (!normalizedAvailableOptions.includes(normalizedOption)) {
        throw new Error(
          `Invalid option: ${chosenOption}. Available options: ${toss.tossOptions.join(", ")}`,
        );
      }
    }

    // Add player to participants list (for backward compatibility)
    toss.participants.push(player);

    // Add player with their chosen option
    toss.participantOptions.push({
      inboxId: player,
      option: chosenOption,
    });

    // Update toss status based on number of participants
    if (toss.participants.length === 1) {
      toss.status = TossStatus.WAITING_FOR_PLAYER;
    } else if (toss.participants.length >= 2) {
      toss.status = TossStatus.WAITING_FOR_PLAYER;
    }

    await storage.updateToss(toss);
    return toss;
  }

  async joinGame(tossId: string, player: string): Promise<CoinTossGame> {
    const toss = await storage.getToss(tossId);
    if (!toss) {
      throw new Error("Toss not found");
    }

    if (
      toss.status !== TossStatus.CREATED &&
      toss.status !== TossStatus.WAITING_FOR_PLAYER
    ) {
      throw new Error("Toss is not accepting players");
    }

    if (toss.participants.includes(player)) {
      throw new Error("You are already in this toss");
    }

    // Don't add the player yet, just return the toss info with available options
    return toss;
  }

  async verifyPayment(inboxId: string, tossId: string): Promise<boolean> {
    const toss = await storage.getToss(tossId);
    if (!toss) {
      return false;
    }

    // Get user's wallet
    const userWallet = await this.walletService.getWallet(inboxId);
    if (!userWallet) {
      return false;
    }

    try {
      // Check if the user has already transferred funds
      const tossWalletBalance = await this.walletService.checkBalance(tossId);
      if (!tossWalletBalance.address) return false;

      // Check if the toss wallet has the required funds
      return tossWalletBalance.balance >= parseFloat(toss.tossAmount);
    } catch (error) {
      console.error("Error verifying payment:", error);
      return false;
    }
  }

  async makePayment(
    inboxId: string,
    tossId: string,
    amount: string,
    chosenOption: string,
  ): Promise<boolean> {
    console.log(`💸 PROCESSING PAYMENT`);
    console.log(`👤 User: ${inboxId}`);
    console.log(`🎮 Toss ID: ${tossId}`);
    console.log(`💰 Amount: ${amount} USDC`);
    console.log(`🎯 Chosen Option: ${chosenOption}`);

    try {
      // Get user's wallet
      console.log(`🔑 Getting user wallet...`);
      const userWallet = await this.walletService.getWallet(inboxId);
      if (!userWallet) {
        console.error(`❌ User wallet not found for ${inboxId}`);
        throw new Error("User wallet not found");
      }
      console.log(`✅ User wallet found: ${userWallet.agent_address}`);

      // Get toss wallet
      console.log(`🔑 Getting toss information...`);
      const toss = await storage.getToss(tossId);
      if (!toss) {
        console.error(`❌ Toss not found: ${tossId}`);
        throw new Error("Toss not found");
      }
      console.log(`✅ Toss found, toss wallet address: ${toss.walletAddress}`);

      // Transfer funds from user to toss wallet
      console.log(
        `💸 Transferring ${amount} USDC from ${inboxId} to toss wallet ${toss.walletAddress}...`,
      );
      const transfer = await this.walletService.transfer(
        inboxId,
        toss.walletAddress,
        parseFloat(amount),
      );

      if (transfer) {
        console.log(`✅ Payment successful!`);
        return true;
      } else {
        console.error(`❌ Payment failed.`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error making payment:`, error);
      return false;
    }
  }

  async executeCoinToss(
    tossId: string,
    winningOption: string,
  ): Promise<CoinTossGame> {
    console.log(`🎲 EXECUTING TOSS for Toss: ${tossId}`);

    const toss = await storage.getToss(tossId);
    if (!toss) {
      throw new Error("Toss not found");
    }

    // Validate toss state
    if (toss.status !== TossStatus.WAITING_FOR_PLAYER) {
      throw new Error(
        `Toss is not ready for execution. Current status: ${toss.status}`,
      );
    }

    if (toss.participants.length < 2) {
      throw new Error("Toss needs at least 2 players");
    }

    if (!toss.participantOptions.length) {
      throw new Error("No participant options found in the toss");
    }

    // Get options from the toss or participant choices
    const options = toss.tossOptions?.length
      ? toss.tossOptions
      : [...new Set(toss.participantOptions.map((p) => p.option))];

    if (options.length < 2) {
      throw new Error("Not enough unique options to choose from");
    }

    // Set toss in progress
    toss.status = TossStatus.IN_PROGRESS;
    await storage.updateToss(toss);
    console.log(`🏁 Toss status updated to IN_PROGRESS`);

    // Validate winning option
    const matchingOption = options.find(
      (option) => option.toLowerCase() === winningOption.toLowerCase(),
    );

    if (!matchingOption) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error(`Invalid winning option provided: ${winningOption}`);
    }

    // Set the result
    toss.tossResult = matchingOption;

    // Find winners
    const winners = toss.participantOptions.filter(
      (p) => p.option.toLowerCase() === matchingOption.toLowerCase(),
    );

    if (!winners.length) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error(`No winners found for option: ${matchingOption}`);
    }

    // Calculate prize per winner
    const totalPot = parseFloat(toss.tossAmount) * toss.participants.length;
    const prizePerWinner = totalPot / winners.length;

    // Distribute prizes
    const tossWallet = await this.walletService.getWallet(tossId);
    if (!tossWallet) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error("Toss wallet not found");
    }

    const successfulTransfers: string[] = [];

    for (const winner of winners) {
      try {
        if (!winner.inboxId) continue;

        const winnerWalletData = await this.walletService.getWallet(
          winner.inboxId,
        );
        if (!winnerWalletData) continue;

        const transfer = await this.walletService.transfer(
          tossWallet.inboxId,
          winnerWalletData.agent_address,
          prizePerWinner,
        );

        if (transfer) {
          successfulTransfers.push(winner.inboxId);

          // Set transaction link from first successful transfer
          if (!toss.transactionLink) {
            const transferData = transfer as unknown as Transfer;
            toss.transactionLink =
              transferData.model?.sponsored_send?.transaction_link;
          }
        }
      } catch (error) {
        console.error(
          `Error processing transfer for ${winner.inboxId}:`,
          error,
        );
      }
    }

    // Complete the toss
    toss.status = TossStatus.COMPLETED;
    toss.winner = winners.map((w) => w.inboxId).join(",");
    toss.paymentSuccess = successfulTransfers.length === winners.length;

    await storage.updateToss(toss);

    return toss;
  }

  async listActiveTosses(): Promise<CoinTossGame[]> {
    return storage.listActiveTosses();
  }

  async getToss(tossId: string): Promise<CoinTossGame | null> {
    return storage.getToss(tossId);
  }

  async getLastIdToss(): Promise<number> {
    try {
      const tossesDir = storage.getTossStorageDir();
      const files = await fs.readdir(tossesDir);

      // Extract numeric IDs from filenames (handling pattern like "1-base-sepolia.json")
      const tossIds = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          // Match the numeric ID at the beginning of the filename
          const match = file.match(/^(\d+)-/);
          return match ? parseInt(match[1], 10) : 0;
        });

      // Find the maximum ID (or return 0 if no files exist)
      const maxId = tossIds.length > 0 ? Math.max(...tossIds) : 0;
      console.log(`Highest toss ID found: ${maxId}`);
      return maxId;
    } catch (error) {
      console.error("Error counting total tosses:", error);
      return 0;
    }
  }

  async getTotalTossCount(): Promise<number> {
    try {
      const tossesDir = storage.getTossStorageDir();
      const files = await fs.readdir(tossesDir);
      const tossCount = files.filter((file) => file.endsWith(".json")).length;
      console.log(`Found ${tossCount} total tosses in the system`);
      return tossCount;
    } catch (error) {
      console.error("Error counting total tosses:", error);
      return 0;
    }
  }

  async cancelGame(tossId: string): Promise<CoinTossGame> {
    const toss = await storage.getToss(tossId);
    if (!toss) {
      throw new Error("Toss not found");
    }

    if (toss.status === TossStatus.COMPLETED) {
      throw new Error("Cannot cancel completed toss");
    }

    toss.status = TossStatus.CANCELLED;
    await storage.updateToss(toss);
    return toss;
  }

  /**
   * Create a toss from a natural language prompt
   * @param creator The user ID of the creator
   * @param naturalLanguagePrompt The natural language prompt describing the toss
   * @param agent The cdp agent
   * @param agentConfig The agent configuration
   * @returns The created toss
   */
  async createGameFromPrompt(
    creator: string,
    naturalLanguagePrompt: string,
    agent: ReturnType<typeof createReactAgent>,
    agentConfig: AgentConfig,
  ): Promise<CoinTossGame> {
    console.log(`🎲 CREATING TOSS FROM NATURAL LANGUAGE PROMPT`);
    console.log(`👤 Creator: ${creator}`);
    console.log(`💬 Prompt: "${naturalLanguagePrompt}"`);

    // Parse the natural language prompt using the CDP agent
    const parsedToss = await parseNaturalLanguageToss(
      agent,
      agentConfig,
      naturalLanguagePrompt,
    );

    if (typeof parsedToss === "string") {
      throw new Error(parsedToss);
    }
    // Store the toss details
    console.log(`📝 Parsed toss topic: "${parsedToss.topic}"`);
    console.log(`🎯 Parsed options: [${parsedToss.options.join(", ")}]`);
    console.log(`💰 Parsed amount: ${parsedToss.amount} USDC`);

    // Create the toss using the parsed values (don't auto-join creator)
    const toss = await this.createGame(creator, parsedToss.amount);

    // Add additional toss information
    toss.tossTopic = parsedToss.topic;
    toss.tossOptions = parsedToss.options;

    // Update the toss with the additional information
    await storage.updateToss(toss);

    return toss;
  }
}
