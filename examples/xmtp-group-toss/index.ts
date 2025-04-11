import { existsSync, mkdirSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import {
  AgentKit,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import {
  Coinbase,
  TimeoutError,
  Wallet,
  type Transfer as CoinbaseTransfer,
  type Trade,
  type WalletData,
} from "@coinbase/coinbase-sdk";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { isAddress } from "viem";
import "dotenv/config";
import { getRandomValues } from "node:crypto";
import { IdentifierKind, type Signer } from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const logAgentDetails = (
  address: string,
  inboxId: string,
  env: string,
) => {
  const createLine = (length: number, char = "═"): string =>
    char.repeat(length - 2);
  const centerText = (text: string, width: number): string => {
    const padding = Math.max(0, width - text.length);
    const leftPadding = Math.floor(padding / 2);
    return " ".repeat(leftPadding) + text + " ".repeat(padding - leftPadding);
  };

  console.log(`\x1b[38;2;252;76;52m
    ██╗  ██╗███╗   ███╗████████╗██████╗ 
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ 
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     
  \x1b[0m`);

  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  const maxLength = Math.max(url.length + 12, address.length + 15, 30);

  // Get the current folder name from the process working directory
  const currentFolder = process.cwd().split("/").pop() || "";
  const dbPath = `../${currentFolder}/xmtp-${env}-${address}.db3`;
  const maxLengthWithDbPath = Math.max(maxLength, dbPath.length + 15);

  const box = [
    `╔${createLine(maxLengthWithDbPath)}╗`,
    `║   ${centerText("Agent Details", maxLengthWithDbPath - 6)} ║`,
    `╟${createLine(maxLengthWithDbPath, "─")}╢`,
    `║ 📍 Address: ${address}${" ".repeat(maxLengthWithDbPath - address.length - 15)}║`,
    `║ 📍 inboxId: ${inboxId}${" ".repeat(maxLengthWithDbPath - inboxId.length - 15)}║`,
    `║ 📂 DB Path: ${dbPath}${" ".repeat(maxLengthWithDbPath - dbPath.length - 15)}║`,
    `║ 🛜  Network: ${env}${" ".repeat(maxLengthWithDbPath - env.length - 15)}║`,
    `║ 🔗 URL: ${url}${" ".repeat(maxLengthWithDbPath - url.length - 11)}║`,
    `╚${createLine(maxLengthWithDbPath)}╝`,
  ].join("\n");

  console.log(box);
};

export function validateEnvironment(vars: string[]): Record<string, string> {
  const requiredVars = vars;
  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length) {
    console.error("Missing env vars:", missing.join(", "));
    process.exit(1);
  }

  return requiredVars.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] as string;
    return acc;
  }, {});
}

interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

export const createUser = (key: string): User => {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key: key as `0x${string}`,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
};

export const createSigner = (key: string): Signer => {
  const sanitizedKey = key.startsWith("0x") ? key : `0x${key}`;
  const user = createUser(sanitizedKey);
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifierKind: IdentifierKind.Ethereum,
      identifier: user.account.address.toLowerCase(),
    }),
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        message,
        account: user.account,
      });
      return toBytes(signature);
    },
  };
};

/**
 * Generate a random encryption key
 * @returns The encryption key
 */
export const generateEncryptionKeyHex = () => {
  /* Generate a random encryption key */
  const uint8Array = getRandomValues(new Uint8Array(32));
  /* Convert the encryption key to a hex string */
  return toString(uint8Array, "hex");
};

/**
 * Get the encryption key from a hex string
 * @param hex - The hex string
 * @returns The encryption key
 */
export const getEncryptionKeyFromHex = (hex: string) => {
  /* Convert the hex string to an encryption key */
  return fromString(hex, "hex");
};

const { CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, NETWORK_ID } =
  validateEnvironment([
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "NETWORK_ID",
  ]);

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

// Initialize Coinbase SDK
function initializeCoinbaseSDK(): boolean {
  try {
    Coinbase.configure({
      apiKeyName: CDP_API_KEY_NAME,
      privateKey: CDP_API_KEY_PRIVATE_KEY,
    });
    console.log("Coinbase SDK initialized successfully, network:", NETWORK_ID);
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
      console.log(`Creating wallet on network: ${NETWORK_ID}`);

      // Create wallet
      const wallet = await Wallet.create({
        networkId: NETWORK_ID,
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
  ): Promise<CoinbaseTransfer | undefined> {
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

export const WALLET_STORAGE_DIR = ".data/wallet_data";
export const XMTP_STORAGE_DIR = ".data/xmtp";
export const TOSS_STORAGE_DIR = ".data/tosses";

/**
 * Storage service for coin toss  data and user wallets
 */
class StorageService {
  private initialized = false;

  constructor() {
    // Initialize directories on creation
    this.initialize();
  }

  /**
   * Initialize storage directories
   */
  public initialize(): void {
    if (this.initialized) return;

    // Ensure storage directories exist
    [WALLET_STORAGE_DIR, TOSS_STORAGE_DIR, XMTP_STORAGE_DIR].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });

    this.initialized = true;
    console.log("Local file storage initialized");
  }

  /**
   * Save data to a JSON file
   */
  private async saveToFile(
    directory: string,
    identifier: string,
    data: string,
  ): Promise<boolean> {
    const toRead = `${identifier}-${NETWORK_ID}`;
    try {
      const filePath = path.join(directory, `${toRead}.json`);
      await fs.writeFile(filePath, data);
      return true;
    } catch (error) {
      console.error(`Error writing to file ${toRead}:`, error);
      return false;
    }
  }

  /**
   * Read data from a JSON file
   */
  private async readFromFile<T>(
    directory: string,
    identifier: string,
  ): Promise<T | null> {
    try {
      const key = `${identifier}-${NETWORK_ID}`;
      const filePath = path.join(directory, `${key}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data) as T;
    } catch (error) {
      // If file doesn't exist, return null
      if (
        error instanceof Error &&
        (error.message.includes("ENOENT") ||
          error.message.includes("no such file or directory"))
      ) {
        return null;
      }
      // For other errors, rethrow
      throw error;
    }
  }

  /**
   * Save a coin toss game
   */
  public async saveToss(toss: GroupTossName): Promise<void> {
    if (!this.initialized) this.initialize();
    await this.saveToFile(TOSS_STORAGE_DIR, toss.id, JSON.stringify(toss));
  }

  /**
   * Get a coin toss game by ID
   */
  public async getToss(tossId: string): Promise<GroupTossName | null> {
    if (!this.initialized) this.initialize();
    return this.readFromFile<GroupTossName>(TOSS_STORAGE_DIR, tossId);
  }

  /**
   * List all active games
   */
  public async listActiveTosses(): Promise<GroupTossName[]> {
    if (!this.initialized) this.initialize();

    const tosses: GroupTossName[] = [];
    try {
      const files = await fs.readdir(TOSS_STORAGE_DIR);

      for (const file of files) {
        if (file.endsWith(".json")) {
          const tossId = file.replace(`-${NETWORK_ID}.json`, "");
          const toss = await this.getToss(tossId);
          if (
            toss &&
            toss.status !== TossStatus.COMPLETED &&
            toss.status !== TossStatus.CANCELLED
          ) {
            tosses.push(toss);
          }
        }
      }
    } catch (error) {
      console.error("Error listing active games:", error);
    }

    return tosses;
  }

  /**
   * Update an existing game (alias for saveToss)
   */
  public async updateToss(toss: GroupTossName): Promise<void> {
    await this.saveToss(toss);
  }

  /**
   * Save user wallet data
   */
  public async saveWallet(inboxId: string, walletData: string): Promise<void> {
    if (!this.initialized) this.initialize();
    await this.saveToFile(WALLET_STORAGE_DIR, inboxId, walletData);
  }

  /**
   * Get user wallet data by user ID
   */
  public async getWallet(inboxId: string): Promise<AgentWalletData | null> {
    if (!this.initialized) this.initialize();
    return this.readFromFile<AgentWalletData>(WALLET_STORAGE_DIR, inboxId);
  }

  /**
   * Delete a file
   */
  public async deleteFile(directory: string, key: string): Promise<boolean> {
    try {
      const filePath = path.join(directory, `${key}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      return false;
    }
  }

  /**
   * Get wallet count
   */
  public async getWalletCount(): Promise<number> {
    try {
      const files = await fs.readdir(WALLET_STORAGE_DIR);
      return files.filter((file) => file.endsWith(".json")).length;
    } catch (error) {
      console.error("Error getting wallet count:", error);
      return 0;
    }
  }

  /**
   * Get the toss storage directory
   */
  public getTossStorageDir(): string {
    return TOSS_STORAGE_DIR;
  }
}

// Create a single global instance
const storage = new StorageService();

// Export the storage instance
export { storage };

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

// Agent wallet data
export type AgentWalletData = {
  id: string;
  walletData: WalletData;
  agent_address: string;
  inboxId: string;
  wallet?: Wallet;
};

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

// Interface for parsed JSON response
export interface TossJsonResponse {
  topic?: string;
  options?: string[];
  amount?: string;
  valid?: boolean;
  reason?: string;
}

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

// Global stores for memory and agent instances
const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, ReturnType<typeof createReactAgent>> = {};

export async function initializeAgent(inboxId: string) {
  try {
    // Check if we already have an agent for this user
    if (inboxId in agentStore) {
      console.log(`Using existing agent for user: ${inboxId}`);
      const agentConfig = {
        configurable: { thread_id: `CoinToss Agent for ${inboxId}` },
      };
      return { agent: agentStore[inboxId], config: agentConfig };
    }

    console.log(`Initializing agent for inbox: ${inboxId}`);

    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
    });

    const agentkit = await AgentKit.from({
      cdpApiKeyName: CDP_API_KEY_NAME,
      cdpApiKeyPrivateKey: CDP_API_KEY_PRIVATE_KEY,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: CDP_API_KEY_NAME,
          apiKeyPrivateKey: CDP_API_KEY_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyName: CDP_API_KEY_NAME,
          apiKeyPrivateKey: CDP_API_KEY_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      ],
    });

    console.log("AgentKit initialized successfully");

    const tools = await getLangChainTools(agentkit);

    // Get or create memory saver for this user
    if (!(inboxId in memoryStore)) {
      console.log(`Creating new memory store for user: ${inboxId}`);
      memoryStore[inboxId] = new MemorySaver();
    } else {
      console.log(`Using existing memory store for user: ${inboxId}`);
    }

    const agentConfig = {
      configurable: { thread_id: `CoinToss Agent for ${inboxId}` },
    };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memoryStore[inboxId],
      messageModifier: AGENT_INSTRUCTIONS,
    });

    // Store the agent for future use
    agentStore[inboxId] = agent;

    console.log("Agent created successfully");
    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
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
 * Extract JSON from agent response text
 * @param response The text response from agent
 * @returns Parsed JSON object or null if not found
 */
function extractJsonFromResponse(response: string): TossJsonResponse | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TossJsonResponse;
    }
    return null;
  } catch (error) {
    console.error("Error parsing JSON from agent response:", error);
    return null;
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
  const parsedJson = extractJsonFromResponse(response) as TossJsonResponse;

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
    const { agent, config } = await initializeAgent(inboxId);

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
