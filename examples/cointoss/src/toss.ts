import * as crypto from "crypto";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import { WalletService } from "./cdp";
import { parseNaturalLanguageToss } from "./langchain";
import { storage } from "./storage";
import { TossStatus, type CoinTossGame } from "./types";

// Interface for transfer response
interface Transfer {
  model?: {
    sponsored_send?: {
      transaction_link?: string;
    };
  };
}

export class GameManager {
  private lastGameId: number = 0;
  private walletService: WalletService;

  constructor(agentAddress: string) {
    this.walletService = new WalletService(agentAddress);
    // Initialize lastGameId from storage
    void this.initializeLastGameId();
  }

  private async initializeLastGameId() {
    const tosses = await storage.listActiveGames();
    this.lastGameId = tosses.reduce((maxId, toss) => {
      const id = parseInt(toss.id);
      return isNaN(id) ? maxId : Math.max(maxId, id);
    }, 0);
  }

  private getNextGameId(): string {
    return (++this.lastGameId).toString();
  }

  // Get a player's wallet address from their user ID
  async getPlayerWalletAddress(userId: string): Promise<string | undefined> {
    try {
      const walletData = await this.walletService.getWallet(userId, false);
      return walletData?.agent_address;
    } catch (error) {
      console.error(`Error getting wallet address for ${userId}:`, error);
      return undefined;
    }
  }

  async createGame(creator: string, tossAmount: string): Promise<CoinTossGame> {
    console.log(`🎮 CREATING NEW TOSS`);
    console.log(`👤 Creator: ${creator}`);
    console.log(`💰 Toss Amount: ${tossAmount} USDC`);

    // Create a new wallet for this toss
    console.log(`🔑 Creating wallet for the toss...`);
    const tossId = this.getNextGameId();
    console.log(`🆔 Generated Toss ID: ${tossId}`);

    const tossWallet = await this.walletService.createWallet(`toss:${tossId}`);
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
    await storage.saveGame(toss);
    console.log(`🎮 Toss created successfully!`);
    console.log(`---------------------------------------------`);
    console.log(`TOSS ID: ${tossId}`);
    console.log(`TOSS WALLET: ${tossWallet.agent_address}`);
    console.log(`TOSS AMOUNT: ${tossAmount} USDC`);
    console.log(`STATUS: ${toss.status}`);
    console.log(`---------------------------------------------`);

    // No longer automatically adding creator as first participant

    // Reload the toss to get updated state
    const updatedToss = await storage.getGame(tossId);
    return updatedToss || toss;
  }

  async addPlayerToGame(
    tossId: string,
    player: string,
    chosenOption: string,
    hasPaid: boolean,
  ): Promise<CoinTossGame> {
    const toss = await storage.getGame(tossId);
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
      userId: player,
      option: chosenOption,
    });

    // Update toss status based on number of participants
    if (toss.participants.length === 1) {
      toss.status = TossStatus.WAITING_FOR_PLAYER;
    } else if (toss.participants.length >= 2) {
      toss.status = TossStatus.WAITING_FOR_PLAYER;
    }

    await storage.updateGame(toss);
    return toss;
  }

  async joinGame(tossId: string, player: string): Promise<CoinTossGame> {
    const toss = await storage.getGame(tossId);
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

  async verifyPayment(userId: string, tossId: string): Promise<boolean> {
    const toss = await storage.getGame(tossId);
    if (!toss) {
      return false;
    }

    // Get user's wallet
    const userWallet = await this.walletService.getWallet(userId);
    if (!userWallet) {
      return false;
    }

    try {
      // Check if the user has already transferred funds
      const tossWalletBalance = await this.walletService.checkBalance(
        `toss:${tossId}`,
      );
      if (!tossWalletBalance.address) return false;

      // Check if the toss wallet has the required funds
      return tossWalletBalance.balance >= parseFloat(toss.tossAmount);
    } catch (error) {
      console.error("Error verifying payment:", error);
      return false;
    }
  }

  async makePayment(
    userId: string,
    tossId: string,
    amount: string,
    chosenOption: string,
  ): Promise<boolean> {
    console.log(`💸 PROCESSING PAYMENT`);
    console.log(`👤 User: ${userId}`);
    console.log(`🎮 Toss ID: ${tossId}`);
    console.log(`💰 Amount: ${amount} USDC`);
    console.log(`🎯 Chosen Option: ${chosenOption}`);

    try {
      // Get user's wallet
      console.log(`🔑 Getting user wallet...`);
      const userWallet = await this.walletService.getWallet(userId);
      if (!userWallet) {
        console.error(`❌ User wallet not found for ${userId}`);
        throw new Error("User wallet not found");
      }
      console.log(`✅ User wallet found: ${userWallet.agent_address}`);

      // Get toss wallet
      console.log(`🔑 Getting toss information...`);
      const toss = await storage.getGame(tossId);
      if (!toss) {
        console.error(`❌ Toss not found: ${tossId}`);
        throw new Error("Toss not found");
      }
      console.log(`✅ Toss found, toss wallet address: ${toss.walletAddress}`);

      // Transfer funds from user to toss wallet
      console.log(
        `💸 Transferring ${amount} USDC from ${userId} to toss wallet ${toss.walletAddress}...`,
      );
      const transfer = await this.walletService.transfer(
        userId,
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

  async executeCoinToss(tossId: string): Promise<CoinTossGame> {
    console.log(`🎲 EXECUTING TOSS for Toss: ${tossId}`);

    const toss = await storage.getGame(tossId);
    if (!toss) {
      console.error(`❌ Toss not found: ${tossId}`);
      throw new Error("Toss not found");
    }

    if (toss.status !== TossStatus.WAITING_FOR_PLAYER) {
      console.error(
        `❌ Toss is not ready for execution. Current status: ${toss.status}`,
      );
      throw new Error("Toss is not ready for execution");
    }

    if (toss.participants.length < 2) {
      console.error(
        `❌ Toss needs at least 2 players. Current player count: ${toss.participants.length}`,
      );
      throw new Error("Toss needs at least 2 players");
    }

    console.log(`👥 Toss participants: ${toss.participants.join(", ")}`);
    const totalPot = parseFloat(toss.tossAmount) * toss.participants.length;
    console.log(`💰 Total pot: ${totalPot} USDC`);

    toss.status = TossStatus.IN_PROGRESS;
    await storage.updateGame(toss);
    console.log(`🏁 Toss status updated to IN_PROGRESS`);

    // Verify participants array is not empty
    if (toss.participants.length === 0) {
      console.error(`❌ No participants found in the toss`);
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateGame(toss);
      return toss;
    }

    // Check if participantOptions is initialized and has entries
    if (toss.participantOptions.length === 0) {
      console.error(`❌ No participant options found in the toss`);
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateGame(toss);
      return toss;
    }

    // Determine the available options
    let options: string[] = [];
    if (toss.tossOptions && toss.tossOptions.length > 0) {
      options = toss.tossOptions;
    } else {
      // Extract unique options from participant choices
      const uniqueOptions = new Set<string>();
      toss.participantOptions.forEach((p) => uniqueOptions.add(p.option));
      options = Array.from(uniqueOptions);
    }

    // Make sure we have at least two options
    if (options.length < 2) {
      console.error(`❌ Not enough unique options to choose from`);
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateGame(toss);
      return toss;
    }

    console.log(
      `🎲 Executing toss to select between options: ${options.join(" or ")}`,
    );

    // Generate random selection for winning option
    const randomBuffer = crypto.randomBytes(8);
    const timestamp = Date.now();
    const randomValue =
      (timestamp ^ parseInt(randomBuffer.toString("hex"), 16)) % 1000000;
    const winningOptionIndex = randomValue % options.length;
    const winningOption = options[winningOptionIndex];

    // Set the toss result
    toss.tossResult = winningOption;
    console.log(`🎯 Winning option selected: ${winningOption}`);

    // Find all winners (participants who chose the winning option)
    const winners = toss.participantOptions.filter(
      (p) => p.option.toLowerCase() === winningOption.toLowerCase(),
    );

    if (winners.length === 0) {
      console.error(`❌ No winners found for option: ${winningOption}`);
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateGame(toss);
      return toss;
    }

    console.log(
      `🏆 ${winners.length} winner(s) found who chose ${winningOption}`,
    );

    // Calculate prize money per winner
    const prizePerWinner = totalPot / winners.length;
    console.log(`💰 Prize per winner: ${prizePerWinner.toFixed(6)} USDC`);

    // Update toss with results
    toss.status = TossStatus.COMPLETED;
    toss.winner = winners.map((w) => w.userId).join(","); // Comma-separated list of winner IDs

    // Transfer winnings from toss wallet to winners
    console.log(`💸 Transferring winnings to ${winners.length} winners...`);

    let allTransfersSuccessful = true;
    const successfulTransfers: string[] = [];

    try {
      // Get toss wallet
      const tossWallet = await this.walletService.getWallet(`toss:${tossId}`);
      if (!tossWallet) {
        console.error(`❌ Toss wallet not found`);
        toss.paymentSuccess = false;
        await storage.updateGame(toss);
        return toss;
      }

      // Process transfers for each winner
      for (const winner of winners) {
        try {
          if (!winner.userId) {
            console.error(`❌ Winner ID is undefined, skipping transfer`);
            allTransfersSuccessful = false;
            continue;
          }

          console.log(`🏆 Processing transfer for winner: ${winner.userId}`);

          // Get the winner's wallet address
          const winnerWalletData = await this.walletService.getWallet(
            winner.userId,
            false,
          );
          if (!winnerWalletData) {
            console.error(
              `❌ Winner wallet data not found for ${winner.userId}`,
            );
            allTransfersSuccessful = false;
            continue;
          }

          const winnerWalletAddress = winnerWalletData.agent_address;
          console.log(`🔍 Winner wallet address: ${winnerWalletAddress}`);

          // Transfer the winner's share
          const transfer = await this.walletService.transfer(
            winner.userId,
            winnerWalletAddress,
            prizePerWinner,
          );

          if (transfer) {
            console.log(
              `✅ Successfully transferred ${prizePerWinner.toFixed(6)} USDC to ${winner.userId}`,
            );
            successfulTransfers.push(winner.userId);

            // Extract transaction link from the first successful transfer
            if (!toss.transactionLink) {
              try {
                // Safe type casting
                const transferData = transfer as unknown as Transfer;
                if (transferData.model?.sponsored_send?.transaction_link) {
                  toss.transactionLink =
                    transferData.model.sponsored_send.transaction_link;
                  console.log(`🔗 Transaction Link: ${toss.transactionLink}`);
                }
              } catch (error) {
                console.error("Error extracting transaction link:", error);
              }
            }
          } else {
            console.error(`❌ Failed to transfer winnings to ${winner.userId}`);
            allTransfersSuccessful = false;
          }
        } catch (error) {
          console.error(
            `❌ Error processing transfer for ${winner.userId}:`,
            error,
          );
          allTransfersSuccessful = false;
        }
      }

      // Set payment success based on all transfers
      toss.paymentSuccess = allTransfersSuccessful;
      if (
        successfulTransfers.length > 0 &&
        successfulTransfers.length < winners.length
      ) {
        console.warn(
          `⚠️ Partial payment success: ${successfulTransfers.length}/${winners.length} transfers completed`,
        );
      }
    } catch (error) {
      console.error(`❌ Error transferring winnings:`, error);
      toss.paymentSuccess = false;
    }

    // Save final toss state
    await storage.updateGame(toss);
    console.log(`🏁 Toss completed. Final status saved.`);

    return toss;
  }

  async listActiveGames(): Promise<CoinTossGame[]> {
    return storage.listActiveGames();
  }

  async getGame(tossId: string): Promise<CoinTossGame | null> {
    return storage.getGame(tossId);
  }

  async cancelGame(tossId: string): Promise<CoinTossGame> {
    const toss = await storage.getGame(tossId);
    if (!toss) {
      throw new Error("Toss not found");
    }

    if (toss.status === TossStatus.COMPLETED) {
      throw new Error("Cannot cancel completed toss");
    }

    toss.status = TossStatus.CANCELLED;
    await storage.updateGame(toss);
    return toss;
  }

  async getUserBalance(userId: string): Promise<number> {
    try {
      const balance = await this.walletService.checkBalance(userId);
      return balance.balance;
    } catch (error) {
      console.error("Error getting user balance:", error);
      return 0;
    }
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
    agentConfig: { configurable: { thread_id: string } },
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
    await storage.updateGame(toss);

    return toss;
  }
}
