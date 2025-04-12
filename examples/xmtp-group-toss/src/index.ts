import * as fs from "fs/promises";
import { HumanMessage } from "@langchain/core/messages";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import {
  type Client,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import { initializeAgent, WalletService } from "./cdp";
import {
  extractJsonFromResponse,
  initializeXmtpClient,
  TossStatus,
  type AgentConfig,
  type GroupTossName,
  type MessageHandler,
  type ParsedToss,
  type StreamChunk,
} from "./helper";
import { storage } from "./storage";

// Constants
const DEFAULT_OPTIONS = ["yes", "no"];
const DEFAULT_AMOUNT = "1";
const USDC_TOKEN_ADDRESS = "0x5dEaC602762362FE5f135FA5904351916053cF70";

// Help message for users
const HELP_MESSAGE = `Available commands:

@toss <natural language toss> - Create a toss using natural language

for example:
"Will it rain tomorrow for 5" - Creates a yes/no toss with 5 USDC
"Lakers vs Celtics for 10" - Creates a toss with Lakers and Celtics as options with 10 USDC

Other commands:
@toss join <tossId> <option> - Join an existing toss with the specified ID and your chosen option
@toss close <tossId> <option> - Close the toss and set the winning option (only for toss creator)
@toss help - Show this help message
`;

// Agent instructions template
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
    console.log(
      `🎮 CREATING NEW TOSS (Creator: ${creator}, Amount: ${tossAmount} USDC)`,
    );

    // Get the next toss ID
    const lastIdToss = await this.getLastIdToss();
    const tossId = (lastIdToss + 1).toString();

    // Create a wallet for this toss
    const tossWallet = await this.walletService.createWallet(tossId);
    console.log(`✅ Toss wallet created: ${tossWallet.agent_address}`);

    const toss: GroupTossName = {
      id: tossId,
      creator,
      tossAmount,
      status: TossStatus.CREATED,
      participants: [],
      participantOptions: [],
      walletAddress: tossWallet.agent_address,
      createdAt: Date.now(),
      tossResult: "",
      paymentSuccess: false,
    };

    await storage.saveToss(toss);
    console.log(
      `🎮 Toss ${tossId} created successfully with wallet ${tossWallet.agent_address}`,
    );

    return toss;
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

    // Validate the chosen option
    if (toss.tossOptions?.length) {
      const normalizedOption = chosenOption.toLowerCase();
      const normalizedAvailableOptions = toss.tossOptions.map((opt: string) =>
        opt.toLowerCase(),
      );

      if (!normalizedAvailableOptions.includes(normalizedOption)) {
        throw new Error(
          `Invalid option: ${chosenOption}. Available options: ${toss.tossOptions.join(", ")}`,
        );
      }
    }

    // Add player to participants
    toss.participants.push(player);
    toss.participantOptions.push({ inboxId: player, option: chosenOption });

    // Update toss status
    toss.status = TossStatus.WAITING_FOR_PLAYER;

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

    // Return toss info without adding player yet
    return toss;
  }

  async makePayment(
    inboxId: string,
    tossId: string,
    amount: string,
    chosenOption: string,
  ): Promise<boolean> {
    console.log(
      `💸 Processing payment: User ${inboxId}, Toss ${tossId}, Amount ${amount}, Option ${chosenOption}`,
    );

    try {
      // Get toss wallet
      const toss = await storage.getToss(tossId);
      if (!toss) {
        throw new Error("Toss not found");
      }

      // Transfer funds
      const transfer = await this.walletService.transfer(
        inboxId,
        toss.walletAddress,
        parseFloat(amount),
      );

      return !!transfer;
    } catch (error) {
      console.error(`❌ Payment error:`, error);
      return false;
    }
  }

  async executeCoinToss(
    tossId: string,
    winningOption: string,
  ): Promise<GroupTossName> {
    console.log(
      `🎲 Executing toss: ${tossId}, winning option: ${winningOption}`,
    );

    const toss = await storage.getToss(tossId);
    if (!toss) {
      throw new Error("Toss not found");
    }

    // Validate toss state
    if (toss.status !== TossStatus.WAITING_FOR_PLAYER) {
      throw new Error(`Toss is not ready (status: ${toss.status})`);
    }

    if (toss.participants.length < 2) {
      throw new Error("Toss needs at least 2 players");
    }

    if (!toss.participantOptions.length) {
      throw new Error("No participant options found");
    }

    // Get options from toss or participant choices
    const options = toss.tossOptions?.length
      ? toss.tossOptions
      : [...new Set(toss.participantOptions.map((p) => p.option))];

    if (options.length < 2) {
      throw new Error("Not enough unique options");
    }

    // Set toss in progress
    toss.status = TossStatus.IN_PROGRESS;
    await storage.updateToss(toss);

    // Validate winning option
    const matchingOption = options.find(
      (option) => option.toLowerCase() === winningOption.toLowerCase(),
    );

    if (!matchingOption) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error(`Invalid winning option: ${winningOption}`);
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

    // Distribute prizes
    const tossWallet = await this.walletService.getWallet(tossId);
    if (!tossWallet) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error("Toss wallet not found");
    }

    const totalPot = parseFloat(toss.tossAmount) * toss.participants.length;
    const prizePerWinner = totalPot / winners.length;
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
        console.error(`Transfer error for ${winner.inboxId}:`, error);
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

      // Extract numeric IDs from filenames (like "1-base-sepolia.json")
      const tossIds = files
        .filter((file) => file.endsWith(".json"))
        .map((file) => {
          const match = file.match(/^(\d+)-/);
          return match ? parseInt(match[1], 10) : 0;
        });

      return tossIds.length > 0 ? Math.max(...tossIds) : 0;
    } catch (error) {
      console.error("Error counting tosses:", error);
      return 0;
    }
  }

  async createGameFromPrompt(
    creator: string,
    prompt: string,
    agent: ReturnType<typeof createReactAgent>,
    agentConfig: AgentConfig,
  ): Promise<GroupTossName> {
    console.log(
      `🎲 Creating toss from prompt: "${prompt}" (Creator: ${creator})`,
    );

    // Parse the natural language prompt
    const parsedToss = await parseNaturalLanguageToss(
      agent,
      agentConfig,
      prompt,
    );

    if (typeof parsedToss === "string") {
      throw new Error(parsedToss);
    }

    // Create the toss
    const toss = await this.createGame(creator, parsedToss.amount);

    // Add parsed information
    toss.tossTopic = parsedToss.topic;
    toss.tossOptions = parsedToss.options;
    await storage.updateToss(toss);

    return toss;
  }
}

/**
 * Entry point for command processing
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

    if (["join", "close", "help"].includes(firstWord)) {
      const [command, ...args] = commandParts;
      return await handleExplicitCommand(command, args, inboxId, tossManager);
    } else {
      return await handleNaturalLanguageCommand(
        content,
        inboxId,
        tossManager,
        agent,
        agentConfig,
      );
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Handle explicit commands (join, close, help)
 */
async function handleExplicitCommand(
  command: string,
  args: string[],
  inboxId: string,
  tossManager: TossManager,
): Promise<string> {
  switch (command.toLowerCase()) {
    case "join": {
      // Validate arguments
      if (args.length < 1) {
        return "Please specify: join <tossId> <option>";
      }

      const tossId = args[0];
      const chosenOption = args.length >= 2 ? args[1] : null;

      if (!tossId) {
        return "Please specify a toss ID: join <tossId> <option>";
      }

      // Check if toss exists
      const toss = await tossManager.getToss(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      // Join the game
      const joinedToss = await tossManager.joinGame(tossId, inboxId);

      // Check if option was provided
      if (!chosenOption) {
        const availableOptions = joinedToss.tossOptions?.length
          ? joinedToss.tossOptions.join(", ")
          : "yes, no";

        return `Please specify your option: join ${tossId} <option>\nAvailable options: ${availableOptions}`;
      }

      // Validate option
      if (
        joinedToss.tossOptions &&
        !joinedToss.tossOptions.some(
          (option) => option.toLowerCase() === chosenOption.toLowerCase(),
        )
      ) {
        return `Invalid option: ${chosenOption}. Available options: ${joinedToss.tossOptions.join(", ")}`;
      }

      // Make payment
      const paymentSuccess = await tossManager.makePayment(
        inboxId,
        tossId,
        toss.tossAmount,
        chosenOption,
      );

      if (!paymentSuccess) {
        return `Payment failed. Please ensure you have enough USDC and try again.`;
      }

      // Add player after payment confirmed
      const updatedToss = await tossManager.addPlayerToGame(
        tossId,
        inboxId,
        chosenOption,
        true,
      );

      // Generate player ID
      const playerPosition =
        updatedToss.participants.findIndex((p) => p === inboxId) + 1;
      const playerId = `P${playerPosition}`;

      // Create response
      let response = `Successfully joined toss ${tossId}! Payment of ${toss.tossAmount} USDC sent.
Your Player ID: ${playerId}
Your Choice: ${chosenOption}
Total players: ${updatedToss.participants.length}`;

      if (updatedToss.tossTopic) {
        response += `\nToss Topic: "${updatedToss.tossTopic}"`;

        if (updatedToss.tossOptions?.length === 2) {
          response += `\nOptions: ${updatedToss.tossOptions[0]} or ${updatedToss.tossOptions[1]}`;
        }
      }

      response +=
        inboxId === toss.creator
          ? `\n\nAs the creator, you can close the toss with: close ${tossId} <option>`
          : `\n\nWaiting for the toss creator to close the toss.`;

      return response;
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

      // Validate toss and permissions
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

      // Execute toss
      let result;
      try {
        result = await tossManager.executeCoinToss(tossId, winningOption);
        if (!result.winner) {
          return "The toss failed to determine a winner. Please try again.";
        }
      } catch (error) {
        return `Error closing toss: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      // Generate player IDs
      const playerMap = await Promise.all(
        result.participants.map(async (player, index) => {
          const walletAddress =
            (await tossManager.getPlayerWalletAddress(player)) || player;
          return {
            id: `P${index + 1}${player === result.creator ? " (Creator)" : ""}`,
            address: player,
            walletAddress,
          };
        }),
      );

      // Create result message
      let resultMessage = `🎲 TOSS RESULTS FOR TOSS #${tossId} 🎲\n\n`;

      if (result.tossTopic) {
        resultMessage += `📝 Toss: "${result.tossTopic}"\n`;
        if (result.tossOptions?.length === 2) {
          resultMessage += `🎯 Options: ${result.tossOptions[0]} or ${result.tossOptions[1]}\n\n`;
        }
      }

      resultMessage += `Players (${result.participants.length}):\n`;

      // List players
      playerMap.forEach((p) => {
        const displayAddress = `${p.walletAddress.substring(0, 10)}...${p.walletAddress.substring(p.walletAddress.length - 6)}`;
        const playerOption =
          result.participantOptions.find((opt) => opt.inboxId === p.address)
            ?.option || "Unknown";
        resultMessage += `${p.id}: ${displayAddress} (Chose: ${playerOption})\n`;
      });

      // Total pot
      const totalPot =
        parseFloat(result.tossAmount) * result.participants.length;
      resultMessage += `\n💰 Total Pot: ${totalPot} USDC\n`;
      resultMessage += `🎯 Winning Option: ${result.tossResult || "Unknown"}\n\n`;

      // Winners
      const winnerIds = result.winner ? result.winner.split(",") : [];
      const winningPlayers = playerMap.filter((p) =>
        winnerIds.includes(p.address),
      );

      if (winningPlayers.length > 0) {
        const prizePerWinner = totalPot / winningPlayers.length;

        resultMessage += `🏆 WINNERS (${winningPlayers.length}):\n`;
        winningPlayers.forEach((winner) => {
          const displayAddress = `${winner.walletAddress.substring(0, 10)}...${winner.walletAddress.substring(winner.walletAddress.length - 6)}`;
          resultMessage += `${winner.id}: ${displayAddress}\n`;
        });

        resultMessage += `\n💸 Prize per winner: ${prizePerWinner.toFixed(6)} USDC\n\n`;
      } else {
        resultMessage += "No winners found.\n\n";
      }

      if (result.paymentSuccess) {
        resultMessage += `✅ Winnings have been transferred to the winners' wallets.`;
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
 */
async function handleNaturalLanguageCommand(
  prompt: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  console.log(`🧠 Processing prompt: "${prompt}"`);

  // Check balance
  const { balance, address } = await tossManager.getBalance(inboxId);
  if (balance < 0.01) {
    return `Insufficient USDC balance. You need at least 0.01 USDC to create a toss. Your balance: ${balance} USDC\nTransfer USDC to your wallet address: ${address}`;
  }

  // Create toss
  const toss = await tossManager.createGameFromPrompt(
    inboxId,
    prompt,
    agent,
    agentConfig,
  );

  // Create response
  let response = `🎲 Toss Created! 🎲\n\n`;
  response += `Toss ID: ${toss.id}\n`;
  response += `Topic: "${toss.tossTopic}"\n`;

  if (toss.tossOptions?.length === 2) {
    response += `Options: ${toss.tossOptions[0]} or ${toss.tossOptions[1]}\n`;
  }

  response += `Toss Amount: ${toss.tossAmount} USDC\n\n`;
  response += `Other players can join with: join ${toss.id} <option>\n`;
  response += `When everyone has joined, you can close the toss with: close ${toss.id} <option>`;

  return response;
}

/**
 * Parse a natural language toss prompt
 */
export async function parseNaturalLanguageToss(
  agent: ReturnType<typeof createReactAgent>,
  config: AgentConfig,
  prompt: string,
): Promise<ParsedToss> {
  // Default values
  const defaultResult: ParsedToss = {
    topic: prompt,
    options: DEFAULT_OPTIONS,
    amount: DEFAULT_AMOUNT,
  };

  if (!prompt || prompt.length < 3) {
    return defaultResult;
  }

  // Direct amount extraction via regex (as fallback)
  const amountMatch = prompt.match(/for\s+(\d+(\.\d+)?)\s*$/i);
  const extractedAmount = amountMatch?.[1];

  // Format parsing request
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

  // Process with agent
  const response = await processMessage(agent, config, parsingRequest);
  const parsedJson = extractJsonFromResponse(response);

  if (!parsedJson) {
    throw new Error("Invalid toss request: No JSON found in response");
  }

  if (parsedJson.valid === false) {
    throw new Error(`Invalid toss request: ${parsedJson.reason}`);
  }

  // Combine parsed data with defaults
  return {
    topic: parsedJson.topic ?? prompt,
    options:
      Array.isArray(parsedJson.options) && parsedJson.options.length >= 2
        ? [parsedJson.options[0], parsedJson.options[1]]
        : DEFAULT_OPTIONS,
    amount: extractedAmount || parsedJson.amount || DEFAULT_AMOUNT,
  };
}

/**
 * Process a message with the agent
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
 * Start listening for messages
 */
export async function startMessageListener(
  client: Client,
  handleMessage: MessageHandler,
) {
  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    // Skip messages from the same agent or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    // Extract command
    const command = extractCommand(message.content as string);
    if (!command) {
      continue; // No command found
    }

    console.log(
      `Received: ${message.content as string} from ${message.senderInboxId}`,
    );

    // Get conversation
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Conversation not found, skipping");
      continue;
    }

    // Handle message
    await handleMessage(message, conversation, command);
  }
}

/**
 * Extract command from message content
 */
export function extractCommand(content: string): string | null {
  const botMentionRegex = /@toss\s+(.*)/i;
  const botMentionMatch = content.match(botMentionRegex);
  return botMentionMatch ? botMentionMatch[1].trim() : null;
}

/**
 * Message handler function
 */
async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) {
  try {
    const tossManager = new TossManager();
    const commandContent = command.replace(/^@toss\s+/i, "").trim();
    const inboxId = message.senderInboxId;

    // Initialize agent
    const { agent, config } = await initializeAgent(
      inboxId,
      AGENT_INSTRUCTIONS,
    );

    // Process command
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

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("Starting CoinToss agent...");

  // Initialize XMTP client
  const xmtpClient = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
