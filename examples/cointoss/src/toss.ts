import * as crypto from "crypto";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import { parseNaturalLanguageToss } from "./cdp";
import {
  GameStatus,
  type AgentConfig,
  type CoinTossGame,
  type StorageProvider,
  type TransferData,
  type XMTPUser,
} from "./types";
import { WalletService } from "./walletService";

export class GameManager {
  private lastGameId: number = 0;
  private walletService: WalletService;
  private promptParserAgent: any = null;

  constructor(
    private storage: StorageProvider,
    private agentAddress: string,
  ) {
    this.walletService = new WalletService(agentAddress, agentAddress);
    // Initialize lastGameId from storage
    void this.initializeLastGameId();
  }

  private async initializeLastGameId() {
    const games = await this.storage.listActiveGames();
    this.lastGameId = games.reduce((maxId, game) => {
      const id = parseInt(game.id);
      return isNaN(id) ? maxId : Math.max(maxId, id);
    }, 0);
  }

  private getNextGameId(): string {
    return (++this.lastGameId).toString();
  }

  // Get a player's wallet address from their user ID
  async getPlayerWalletAddress(inboxId: string): Promise<string | undefined> {
    try {
      const walletData = await this.walletService.getWallet(inboxId, false);
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
    const gameId = this.getNextGameId();
    console.log(`🆔 Generated Toss ID: ${gameId}`);

    const gameWallet = await this.walletService.createWallet(`toss:${gameId}`);
    console.log(`✅ Toss wallet created: ${gameWallet.agent_address}`);

    const game: CoinTossGame = {
      id: gameId,
      creator,
      tossAmount: tossAmount,
      status: GameStatus.CREATED,
      participants: [], // Creator will join separately
      participantOptions: [], // Track participant options
      walletAddress: gameWallet.agent_address,
      createdAt: Date.now(),
      coinTossResult: "",
      paymentSuccess: false,
    };

    console.log(`💾 Saving toss to storage...`);
    await this.storage.saveGame(game);
    console.log(`🎮 Toss created successfully!`);
    console.log(`---------------------------------------------`);
    console.log(`TOSS ID: ${gameId}`);
    console.log(`TOSS WALLET: ${gameWallet.agent_address}`);
    console.log(`TOSS AMOUNT: ${tossAmount} USDC`);
    console.log(`STATUS: ${game.status}`);
    console.log(`---------------------------------------------`);

    // No longer automatically adding creator as first participant

    // Reload the toss to get updated state
    const updatedGame = await this.storage.getGame(gameId);
    return updatedGame || game;
  }

  async addPlayerToGame(
    gameId: string,
    player: string,
    chosenOption: string,
    hasPaid: boolean,
  ): Promise<CoinTossGame> {
    const game = await this.storage.getGame(gameId);
    if (!game) {
      throw new Error("Toss not found");
    }

    if (
      game.status !== GameStatus.CREATED &&
      game.status !== GameStatus.WAITING_FOR_PLAYER
    ) {
      throw new Error("Toss is not accepting players");
    }

    if (game.participants.includes(player)) {
      throw new Error("You are already in this toss");
    }

    if (!hasPaid) {
      throw new Error(`Please pay ${game.tossAmount} USDC to join the toss`);
    }

    // Validate the chosen option against available options
    if (game.tossOptions && game.tossOptions.length > 0) {
      const normalizedOption = chosenOption.toLowerCase();
      const normalizedAvailableOptions = game.tossOptions.map((opt) =>
        opt.toLowerCase(),
      );

      if (!normalizedAvailableOptions.includes(normalizedOption)) {
        throw new Error(
          `Invalid option: ${chosenOption}. Available options: ${game.tossOptions.join(", ")}`,
        );
      }
    }

    // Add player to participants list (for backward compatibility)
    game.participants.push(player);

    // Add player with their chosen option
    game.participantOptions.push({
      userId: player,
      option: chosenOption,
    });

    // Update toss status based on number of participants
    if (game.participants.length === 1) {
      game.status = GameStatus.WAITING_FOR_PLAYER;
    } else if (game.participants.length >= 2) {
      game.status = GameStatus.WAITING_FOR_PLAYER;
    }

    await this.storage.updateGame(game);
    return game;
  }

  async joinGame(gameId: string, player: string): Promise<CoinTossGame> {
    const game = await this.storage.getGame(gameId);
    if (!game) {
      throw new Error("Toss not found");
    }

    if (
      game.status !== GameStatus.CREATED &&
      game.status !== GameStatus.WAITING_FOR_PLAYER
    ) {
      throw new Error("Toss is not accepting players");
    }

    if (game.participants.includes(player)) {
      throw new Error("You are already in this toss");
    }

    // Don't add the player yet, just return the toss info with available options
    return game;
  }

  async verifyPayment(userId: string, gameId: string): Promise<boolean> {
    const game = await this.storage.getGame(gameId);
    if (!game) {
      return false;
    }

    // Get user's wallet
    const userWallet = await this.walletService.getWallet(userId);
    if (!userWallet) {
      return false;
    }

    try {
      // Check if the user has already transferred funds
      const gameWalletBalance = await this.walletService.checkBalance(
        `toss:${gameId}`,
      );
      if (!gameWalletBalance.address) return false;

      // Check if the toss wallet has the required funds
      return gameWalletBalance.balance >= parseFloat(game.tossAmount);
    } catch (error) {
      console.error("Error verifying payment:", error);
      return false;
    }
  }

  async makePayment(
    xmtpUser: XMTPUser,
    gameId: string,
    amount: string,
    chosenOption: string,
  ): Promise<boolean> {
    console.log(`💸 PROCESSING PAYMENT`);
    console.log(`👤 User: ${xmtpUser.inboxId}`);
    console.log(`🎮 Toss ID: ${gameId}`);
    console.log(`💰 Amount: ${amount} USDC`);
    console.log(`🎯 Chosen Option: ${chosenOption}`);

    try {
      // Get user's wallet
      console.log(`🔑 Getting user wallet...`);
      const userWallet = await this.walletService.getWallet(xmtpUser.address);
      if (!userWallet) {
        console.error(`❌ User wallet not found for ${xmtpUser.inboxId}`);
        throw new Error("User wallet not found");
      }
      console.log(`✅ User wallet found: ${userWallet.agent_address}`);

      // Get toss wallet
      console.log(`🔑 Getting toss information...`);
      const game = await this.storage.getGame(gameId);
      if (!game) {
        console.error(`❌ Toss not found: ${gameId}`);
        throw new Error("Toss not found");
      }
      console.log(`✅ Toss found, toss wallet address: ${game.walletAddress}`);

      // Transfer funds from user to toss wallet
      console.log(
        `💸 Transferring ${amount} USDC from ${xmtpUser.inboxId} to toss wallet ${game.walletAddress}...`,
      );
      const transfer = await this.walletService.transfer(
        xmtpUser.address,
        game.walletAddress,
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

  async executeCoinToss(gameId: string): Promise<CoinTossGame> {
    console.log(`🎲 EXECUTING COIN TOSS for Toss: ${gameId}`);

    const game = await this.storage.getGame(gameId);
    if (!game) {
      console.error(`❌ Toss not found: ${gameId}`);
      throw new Error("Toss not found");
    }

    if (game.status !== GameStatus.WAITING_FOR_PLAYER) {
      console.error(
        `❌ Toss is not ready for coin toss. Current status: ${game.status}`,
      );
      throw new Error("Toss is not ready for coin toss");
    }

    if (game.participants.length < 2) {
      console.error(
        `❌ Toss needs at least 2 players. Current player count: ${game.participants.length}`,
      );
      throw new Error("Toss needs at least 2 players");
    }

    console.log(`👥 Toss participants: ${game.participants.join(", ")}`);
    const totalPot = parseFloat(game.tossAmount) * game.participants.length;
    console.log(`💰 Total pot: ${totalPot} USDC`);

    game.status = GameStatus.IN_PROGRESS;
    await this.storage.updateGame(game);
    console.log(`🏁 Toss status updated to IN_PROGRESS`);

    // Verify participants array is not empty
    if (game.participants.length === 0) {
      console.error(`❌ No participants found in the toss`);
      game.status = GameStatus.CANCELLED;
      game.paymentSuccess = false;
      await this.storage.updateGame(game);
      return game;
    }

    // Check if participantOptions is initialized and has entries
    if (game.participantOptions.length === 0) {
      console.error(`❌ No participant options found in the toss`);
      game.status = GameStatus.CANCELLED;
      game.paymentSuccess = false;
      await this.storage.updateGame(game);
      return game;
    }

    // Determine the available options
    let options: string[] = [];
    if (game.tossOptions && game.tossOptions.length > 0) {
      options = game.tossOptions;
    } else {
      // Extract unique options from participant choices
      const uniqueOptions = new Set<string>();
      game.participantOptions.forEach((p) => uniqueOptions.add(p.option));
      options = Array.from(uniqueOptions);
    }

    // Make sure we have at least two options
    if (options.length < 2) {
      console.error(`❌ Not enough unique options to choose from`);
      game.status = GameStatus.CANCELLED;
      game.paymentSuccess = false;
      await this.storage.updateGame(game);
      return game;
    }

    console.log(
      `🎲 Flipping the coin to select between options: ${options.join(" or ")}`,
    );

    // Generate random selection for winning option
    const randomBuffer = crypto.randomBytes(8);
    const timestamp = Date.now();
    const randomValue =
      (timestamp ^ parseInt(randomBuffer.toString("hex"), 16)) % 1000000;
    const winningOptionIndex = randomValue % options.length;
    const winningOption = options[winningOptionIndex];

    // Set the coin toss result
    game.coinTossResult = winningOption;
    console.log(`🎯 Winning option selected: ${winningOption}`);

    // Find all winners (participants who chose the winning option)
    const winners = game.participantOptions.filter(
      (p) => p.option.toLowerCase() === winningOption.toLowerCase(),
    );

    if (winners.length === 0) {
      console.error(`❌ No winners found for option: ${winningOption}`);
      game.status = GameStatus.CANCELLED;
      game.paymentSuccess = false;
      await this.storage.updateGame(game);
      return game;
    }

    console.log(
      `🏆 ${winners.length} winner(s) found who chose ${winningOption}`,
    );

    // Calculate prize money per winner
    const prizePerWinner = totalPot / winners.length;
    console.log(`💰 Prize per winner: ${prizePerWinner.toFixed(6)} USDC`);

    // Update toss with results
    game.status = GameStatus.COMPLETED;
    game.winner = winners.map((w) => w.userId).join(","); // Comma-separated list of winner IDs

    // Transfer winnings from toss wallet to winners
    console.log(`💸 Transferring winnings to ${winners.length} winners...`);

    let allTransfersSuccessful = true;
    const successfulTransfers: string[] = [];

    try {
      // Get toss wallet
      const gameWallet = await this.walletService.getWallet(`toss:${gameId}`);
      if (!gameWallet) {
        console.error(`❌ Toss wallet not found`);
        game.paymentSuccess = false;
        await this.storage.updateGame(game);
        return game;
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
            `toss:${gameId}`,
            winnerWalletAddress,
            prizePerWinner,
          );

          if (transfer) {
            console.log(
              `✅ Successfully transferred ${prizePerWinner.toFixed(6)} USDC to ${winner.userId}`,
            );
            successfulTransfers.push(winner.userId);

            // Extract transaction link from the first successful transfer
            if (!game.transactionLink) {
              try {
                const transferData = JSON.parse(
                  JSON.stringify(transfer),
                ) as TransferData;
                if (transferData.transactionLink) {
                  game.transactionLink = transferData.transactionLink;
                  console.log(`🔗 Transaction Link: ${game.transactionLink}`);
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
      game.paymentSuccess = allTransfersSuccessful;
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
      game.paymentSuccess = false;
    }

    // Save final toss state
    await this.storage.updateGame(game);
    console.log(`🏁 Toss completed. Final status saved.`);

    return game;
  }

  async listActiveGames(): Promise<CoinTossGame[]> {
    return this.storage.listActiveGames();
  }

  async getGame(gameId: string): Promise<CoinTossGame | null> {
    return this.storage.getGame(gameId);
  }

  async cancelGame(gameId: string): Promise<CoinTossGame> {
    const game = await this.storage.getGame(gameId);
    if (!game) {
      throw new Error("Toss not found");
    }

    if (game.status === GameStatus.COMPLETED) {
      throw new Error("Cannot cancel completed toss");
    }

    game.status = GameStatus.CANCELLED;
    await this.storage.updateGame(game);
    return game;
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

    // Store the toss details in the toss
    console.log(`📝 Parsed toss topic: "${parsedToss.topic}"`);
    console.log(`🎯 Parsed options: [${parsedToss.options.join(", ")}]`);
    console.log(`💰 Parsed amount: ${parsedToss.amount} USDC`);

    // Create the toss using the parsed values (don't auto-join creator)
    const game = await this.createGame(creator, parsedToss.amount);

    // Add additional toss information to the toss
    game.tossTopic = parsedToss.topic;
    game.tossOptions = parsedToss.options;

    // Update the toss with the additional information
    await this.storage.updateGame(game);

    return game;
  }
}
