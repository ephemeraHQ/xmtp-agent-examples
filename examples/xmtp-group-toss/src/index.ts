import * as fs from "fs/promises";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { HumanMessage } from "@langchain/core/messages";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { initializeAgent, WalletService } from "./cdp";
import { extractJsonFromResponse } from "./helper";
import { storage, XMTP_STORAGE_DIR } from "./storage";

// Constants for default values
const DEFAULT_OPTIONS = ["yes", "no"];
const DEFAULT_AMOUNT = "1";
const USDC_TOKEN_ADDRESS = "0x5dEaC602762362FE5f135FA5904351916053cF70";

/**
 * Agent instruction template for coin toss activities
 */
const AGENT_INSTRUCTIONS = `
  You are a CoinToss Agent that helps users participate in coin toss activities.
  
  You have two main functions:
  1. Process natural language toss requests and structure them
  2. Handle coin toss management commands
  
  When parsing natural language tosses:
  - Extract the toss topic (what people are tossing on)
  - Identify options (default to "yes" and "no" if not provided)
  - Determine toss amount (default to 1 USDC if not specified)
  - Enforce a maximum toss amount of 10 USDC
  
  For example:
  - "Will it rain tomorrow for 5" should be interpreted as a toss on "Will it rain tomorrow" with options ["yes", "no"] and amount "5"
  - "Lakers vs Celtics for 10" should be interpreted as a toss on "Lakers vs Celtics game" with options ["Lakers", "Celtics"] and amount "10"
  
  When checking payments or balances:
  1. Use the USDC token at ${USDC_TOKEN_ADDRESS} on Base.
  2. When asked to check if a payment was sent, verify:
     - The exact amount was transferred
     - The transaction is confirmed
     - The correct addresses were used
  3. For balance checks, show the exact USDC amount available.
  4. When transferring winnings, ensure:
     - The toss wallet has sufficient balance
     - The transfer is completed successfully
     - Provide transaction details
  
  Available commands:
  @toss <topic> <options> <amount> - Create a new toss
  /join <tossId> <option> - Join an existing toss with the specified ID
  /close <tossId> <option> - Close the toss and set the winning option (creator only)
  /status <tossId> - Check toss status and participants
  /list - List all active tosses
  /balance - Check your wallet balance
  /help - Show available commands
  
  Keep responses concise and clear, focusing on payment verification and toss status.
`;

// Constants
export const HELP_MESSAGE = `Available commands:

@toss <natural language toss> - Create a toss using natural language

for example:
"Will it rain tomorrow for 5" - Creates a yes/no toss with 5 USDC
"Lakers vs Celtics for 10" - Creates a toss with Lakers and Celtics as options with 10 USDC

Other commands:
@toss join <tossId> <option> - Join an existing toss with the specified ID and your chosen option
@toss close <tossId> <option> - Close the toss and set the winning option (only for toss creator)
@toss help - Show this help message
`;

/**
 * Entry point for command processing
 * @param content - The message content from the user
 * @param inboxId - The user's identifier
 * @param tossManager - The toss manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
export async function handleCommand(
  content: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  try {
    const commandParts = content.split(" ");
    const firstWord = commandParts[0].toLowerCase();

    // Check if the first word is a command
    if (["join", "close", "help"].includes(firstWord)) {
      // Handle traditional command formatting
      const [command, ...args] = commandParts;
      return await handleExplicitCommand(command, args, inboxId, tossManager);
    } else {
      // This is likely a natural language prompt
      return await handleNaturalLanguageCommand(
        content,
        inboxId,
        tossManager,
        agent,
        agentConfig,
      );
    }
  } catch (error) {
    console.error("Error handling natural language command:", error);
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Handle explicit commands like create, join, close, etc.
 * @param command - The command type
 * @param args - The command arguments
 * @param inboxId - The user's identifier
 * @param tossManager - The toss manager instance
 * @returns Response message to send back to the user
 */
async function handleExplicitCommand(
  command: string,
  args: string[],
  inboxId: string,
  tossManager: TossManager,
): Promise<string> {
  switch (command.toLowerCase()) {
    case "join": {
      // Check if we have enough arguments
      if (args.length < 1) {
        return "Please specify a toss ID and your chosen option: join <tossId> <option>";
      }

      const tossId = args[0];
      const chosenOption = args.length >= 2 ? args[1] : null;

      if (!tossId) {
        return "Please specify a toss ID: join <tossId> <option>";
      }

      // First check if the toss exists
      const toss = await tossManager.getToss(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      // Join the game
      const joinedToss = await tossManager.joinGame(tossId, inboxId);

      // Check if an option was provided
      if (!chosenOption) {
        const availableOptions =
          joinedToss.tossOptions && joinedToss.tossOptions.length > 0
            ? joinedToss.tossOptions.join(", ")
            : "yes, no";

        return `Please specify your option when joining: join ${tossId} <option>\nAvailable options: ${availableOptions}`;
      }

      // Validate the chosen option before making payment
      if (
        joinedToss.tossOptions &&
        !joinedToss.tossOptions.some(
          (option) => option.toLowerCase() === chosenOption.toLowerCase(),
        )
      ) {
        return `Invalid option: ${chosenOption}. Available options: ${joinedToss.tossOptions.join(", ")}`;
      }

      // Make the payment
      const paymentSuccess = await tossManager.makePayment(
        inboxId,
        tossId,
        toss.tossAmount,
        chosenOption,
      );

      if (!paymentSuccess) {
        return `Payment failed. Please ensure you have enough USDC and try again.`;
      }

      // Add player to toss after payment is confirmed
      const updatedToss = await tossManager.addPlayerToGame(
        tossId,
        inboxId,
        chosenOption,
        true,
      );

      // Generate player ID (P2, P3, etc. based on position)
      const playerPosition =
        updatedToss.participants.findIndex((p) => p === inboxId) + 1;
      const playerId = `P${playerPosition}`;

      // Include toss topic and options in the response if available
      let responseMessage = `Successfully joined toss ${tossId}! Payment of ${toss.tossAmount} USDC sent.\nYour Player ID: ${playerId}\nYour Choice: ${chosenOption}\nTotal players: ${updatedToss.participants.length}`;

      if (updatedToss.tossTopic) {
        responseMessage += `\nToss Topic: "${updatedToss.tossTopic}"`;

        if (updatedToss.tossOptions && updatedToss.tossOptions.length === 2) {
          responseMessage += `\nOptions: ${updatedToss.tossOptions[0]} or ${updatedToss.tossOptions[1]}`;
        }
      }

      if (inboxId === toss.creator) {
        responseMessage += `\n\nAs the creator, you can close the toss with: close ${tossId} <option>`;
      } else {
        responseMessage += `\n\nWaiting for the toss creator to close the toss.`;
      }

      return responseMessage;
    }

    case "close": {
      const tossId = args[0];
      const winningOption = args[1];

      if (!tossId) {
        return "Please specify a toss ID: close <tossId> <option>";
      }

      if (!winningOption) {
        return "Please specify the winning option: close <tossId> <option>";
      }

      // Check if the user is the creator
      const toss = await tossManager.getToss(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      if (inboxId !== toss.creator) {
        return "Only the toss creator can close the toss.";
      }

      if (toss.participants.length < 2) {
        return "At least 2 players are needed to close the toss.";
      }

      // Validate winning option
      if (
        toss.tossOptions &&
        !toss.tossOptions.some(
          (option) => option.toLowerCase() === winningOption.toLowerCase(),
        )
      ) {
        return `Invalid option. Please choose one of: ${toss.tossOptions.join(", ")}`;
      }

      let result;
      try {
        result = await tossManager.executeCoinToss(tossId, winningOption);

        // Check if the toss was successful and a winner was determined
        if (!result.winner) {
          return "The toss failed to determine a winner. Please try again.";
        }
      } catch (error) {
        console.error("Error closing toss:", error);
        return `Error closing toss: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      // Generate player IDs for result message
      const playerMap = await Promise.all(
        result.participants.map(async (player, index) => {
          const walletAddress =
            (await tossManager.getPlayerWalletAddress(player)) || player;
          return {
            id: `P${index + 1}${player === result.creator ? " (Creator)" : ""}`,
            address: player,
            walletAddress: walletAddress,
          };
        }),
      );

      // Create detailed result message
      let resultMessage = `🎲 TOSS RESULTS FOR TOSS #${tossId} 🎲\n\n`;

      // Add toss topic if available
      if (result.tossTopic) {
        resultMessage += `📝 Toss: "${result.tossTopic}"\n`;

        if (result.tossOptions && result.tossOptions.length === 2) {
          resultMessage += `🎯 Options: ${result.tossOptions[0]} or ${result.tossOptions[1]}\n\n`;
        }
      }

      resultMessage += `Players (${result.participants.length}):\n`;

      // List all players with their chosen options
      playerMap.forEach((p) => {
        const displayAddress =
          p.walletAddress.substring(0, 10) +
          "..." +
          p.walletAddress.substring(p.walletAddress.length - 6);
        const playerOption =
          result.participantOptions.find((opt) => opt.inboxId === p.address)
            ?.option || "Unknown";
        resultMessage += `${p.id}: ${displayAddress} (Chose: ${playerOption})\n`;
      });

      // Calculate total pot
      const totalPot =
        parseFloat(result.tossAmount) * result.participants.length;
      resultMessage += `\n💰 Total Pot: ${totalPot} USDC\n`;

      // Show the winning option
      resultMessage += `🎯 Winning Option: ${result.tossResult || "Unknown"}\n\n`;

      // Multiple winners handling - identify all players who chose the winning option
      const winnerIds = result.winner ? result.winner.split(",") : [];
      const winningPlayers = playerMap.filter((p) =>
        winnerIds.includes(p.address),
      );

      if (winningPlayers.length > 0) {
        // Calculate prize per winner
        const prizePerWinner = totalPot / winningPlayers.length;

        resultMessage += `🏆 WINNERS (${winningPlayers.length}):\n`;
        winningPlayers.forEach((winner) => {
          const displayAddress =
            winner.walletAddress.substring(0, 10) +
            "..." +
            winner.walletAddress.substring(winner.walletAddress.length - 6);
          resultMessage += `${winner.id}: ${displayAddress}\n`;
        });

        resultMessage += `\n💸 Prize per winner: ${prizePerWinner.toFixed(6)} USDC\n\n`;
      } else {
        resultMessage += "No winners found.\n\n";
      }

      if (result.paymentSuccess) {
        resultMessage += `✅ Winnings have been transferred to the winners' wallets.`;

        // Add transaction link if available
        if (result.transactionLink) {
          resultMessage += `\n🔗 Transaction: ${result.transactionLink}`;
        }
      } else {
        resultMessage += `⚠️ Automatic transfer of winnings failed. Please contact support.`;
      }

      return resultMessage;
    }

    case "help":
      return HELP_MESSAGE;

    default:
      return "Unknown command. Type help to see available commands.";
  }
}

/**
 * Handle natural language toss commands
 * @param prompt - The natural language prompt
 * @param inboxId - The user's identifier
 * @param tossManager - The toss manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
async function handleNaturalLanguageCommand(
  prompt: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  console.log(`🧠 Processing natural language prompt: "${prompt}"`);

  // Check if user has sufficient balance (default check for minimum amount)
  const { balance, address } = await tossManager.getBalance(inboxId);
  if (balance < 0.01) {
    return `Insufficient USDC balance. You need at least 0.01 USDC to create a toss. Your balance: ${balance} USDC\nTransfer USDC to your wallet address: ${address}`;
  }

  // Create a toss using the natural language prompt
  const toss = await tossManager.createGameFromPrompt(
    inboxId,
    prompt,
    agent,
    agentConfig,
  );

  // Create a detailed response with the parsed information
  let response = `🎲 Toss Created! 🎲\n\n`;
  response += `Toss ID: ${toss.id}\n`;
  response += `Topic: "${toss.tossTopic}"\n`;

  if (toss.tossOptions && toss.tossOptions.length === 2) {
    response += `Options: ${toss.tossOptions[0]} or ${toss.tossOptions[1]}\n`;
  }

  response += `Toss Amount: ${toss.tossAmount} USDC\n\n`;
  response += `Other players can join with: join ${toss.id} <option>\n`;
  response += `When everyone has joined, you can close the toss with: close ${toss.id} <option>`;

  return response;
}

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

  async createGame(
    creator: string,
    tossAmount: string,
  ): Promise<GroupTossName> {
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

    const toss: GroupTossName = {
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
  ): Promise<GroupTossName> {
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

    // Add player to participants list
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

  async joinGame(tossId: string, player: string): Promise<GroupTossName> {
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
  ): Promise<GroupTossName> {
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

  async getToss(tossId: string): Promise<GroupTossName | null> {
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

  async createGameFromPrompt(
    creator: string,
    naturalLanguagePrompt: string,
    agent: ReturnType<typeof createReactAgent>,
    agentConfig: AgentConfig,
  ): Promise<GroupTossName> {
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

// Interface to track participant options
export interface Participant {
  inboxId: string;
  option: string;
}

export interface GroupTossName {
  id: string;
  creator: string;
  tossAmount: string;
  status: TossStatus;
  participants: string[]; // Maintaining for backward compatibility
  participantOptions: Participant[]; // New field to track participant options
  winner?: string;
  walletAddress: string;
  createdAt: number;
  tossResult?: string;
  paymentSuccess?: boolean;
  transactionLink?: string;
  tossTopic?: string;
  tossOptions?: string[];
}

export enum TossStatus {
  CREATED = "CREATED",
  WAITING_FOR_PLAYER = "WAITING_FOR_PLAYER",
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

// Interface for parsed toss information
export interface ParsedToss {
  topic: string;
  options: string[];
  amount: string;
}

// Define stream chunk types
export interface AgentChunk {
  agent: {
    messages: Array<{
      content: string;
    }>;
  };
}

export interface ToolsChunk {
  tools: {
    messages: Array<{
      content: string;
    }>;
  };
}

export type StreamChunk = AgentChunk | ToolsChunk;

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/**
 * Initialize the XMTP client
 */
export async function initializeXmtpClient() {
  // Create the signer using viem
  const signer = createSigner(WALLET_KEY);
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;

  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
    dbPath: XMTP_STORAGE_DIR + `/${XMTP_ENV}-${address}`,
  });

  logAgentDetails(address, client.inboxId, XMTP_ENV);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  return client;
}

export type MessageHandler = (
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) => Promise<void>;

/**
 * Start listening for messages and handle them with the provided handler
 */
export async function startMessageListener(
  client: Client,
  handleMessage: MessageHandler,
) {
  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    // Ignore messages from the same agent or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }
    // Extract command from the message content
    const command = extractCommand(message.content as string);
    if (!command) {
      console.log(`Not a command, skipping`);
      continue; // No command found, skip
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    // Get the conversation
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    // Handle the message
    await handleMessage(message, conversation, command);
  }
}

/**
 * Extract command from message content
 * @param content Message content
 * @returns Command extracted from the message content or null if no command is found
 */
export function extractCommand(content: string): string | null {
  // Check for @toss mentions
  const botMentionRegex = /@toss\s+(.*)/i;
  const botMentionMatch = content.match(botMentionRegex);

  if (botMentionMatch) {
    // We found an @toss mention, extract everything after it
    return botMentionMatch[1].trim();
  }

  return null;
}

/**
 * Process a message with the agent
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param message - The user message
 * @returns The agent's response
 */
export async function processMessage(
  agent: ReturnType<typeof createReactAgent>,
  config: AgentConfig,
  message: string,
): Promise<string> {
  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      config,
    );

    let response = "";
    for await (const chunk of stream as AsyncIterable<StreamChunk>) {
      if ("agent" in chunk) {
        const content = chunk.agent.messages[0].content;
        if (typeof content === "string") {
          response += content + "\n";
        }
      } else if ("tools" in chunk) {
        const content = chunk.tools.messages[0].content;
        if (typeof content === "string") {
          response += content + "\n";
        }
      }
    }

    return response.trim();
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error while processing your request. Please try again.";
  }
}

/**
 * Parse a natural language toss prompt to extract structured information
 * @param agent - The agent
 * @param config - Agent configuration
 * @param prompt - The natural language prompt
 * @returns Parsed toss information
 */
export async function parseNaturalLanguageToss(
  agent: ReturnType<typeof createReactAgent>,
  config: AgentConfig,
  prompt: string,
): Promise<ParsedToss> {
  // Default values in case parsing fails
  const defaultResult: ParsedToss = {
    topic: prompt,
    options: DEFAULT_OPTIONS,
    amount: DEFAULT_AMOUNT,
  };

  if (!prompt || prompt.length < 3) {
    return defaultResult;
  }

  console.log(`🔄 Parsing natural language toss: "${prompt}"`);

  // Check for amount directly in the prompt with regex
  // This is a fallback in case the agent fails
  const amountMatch = prompt.match(/for\s+(\d+(\.\d+)?)\s*$/i);
  let extractedAmount = null;
  if (amountMatch && amountMatch[1]) {
    extractedAmount = amountMatch[1];
    console.log(`💰 Directly extracted amount: ${extractedAmount}`);
  }

  // Format specific request for parsing
  const parsingRequest = `
      Parse this toss request into structured format: "${prompt}"
      
      First, do a vibe check:
      1. Is this a genuine toss topic like "Will it rain tomorrow" or "Lakers vs Celtics"?
      2. Is it NOT a join attempt or command?
      3. Is it NOT inappropriate content?
      
      If it fails the vibe check, return:
      {
        "valid": false,
        "reason": "brief explanation why"
      }
      
      If it passes the vibe check, return only a valid JSON object with these fields:
      {
        "valid": true,
        "topic": "the tossing topic",
        "options": ["option1", "option2"],
        "amount": "toss amount"
      }
    `;

  // Process with the agent
  const response = await processMessage(agent, config, parsingRequest);
  const parsedJson = extractJsonFromResponse(response);

  if (!parsedJson) {
    throw new Error("Invalid toss request: No JSON found in response");
  }

  if (parsedJson.valid === false) {
    throw new Error(`Invalid toss request: ${parsedJson.reason}`);
  }

  // Validate and provide defaults if needed
  const result: ParsedToss = {
    topic: parsedJson.topic ?? prompt,
    options:
      Array.isArray(parsedJson.options) && parsedJson.options.length >= 2
        ? [parsedJson.options[0], parsedJson.options[1]]
        : DEFAULT_OPTIONS,
    // Prioritize directly extracted amount if available
    amount: extractedAmount || parsedJson.amount || DEFAULT_AMOUNT,
  };

  console.log(
    `✅ Parsed toss: "${result.topic}" with options [${result.options.join(", ")}] for ${result.amount} USDC`,
  );
  return result;
}

async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) {
  try {
    const tossManager = new TossManager();
    const commandContent = command.replace(/^@toss\s+/i, "").trim();
    // Use the sender's address as the user ID
    const inboxId = message.senderInboxId;
    // Initialize or get the agent for this user
    const { agent, config } = await initializeAgent(
      inboxId,
      AGENT_INSTRUCTIONS,
    );

    const response = await handleCommand(
      commandContent,
      inboxId,
      tossManager,
      agent,
      config,
    );

    await conversation.send(response);
    console.log(`✅ Response sent: ${response.substring(0, 50)}...`);
  } catch (error) {
    console.error("Error:", error);
  }
}
async function main(): Promise<void> {
  console.log("Starting agent...");

  // Initialize XMTP client
  const xmtpClient = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
