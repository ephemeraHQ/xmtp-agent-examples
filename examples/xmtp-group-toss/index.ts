import * as fs from "fs/promises";
import { HumanMessage } from "@langchain/core/messages";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { Client, Conversation, DecodedMessage } from "@xmtp/node-sdk";
import "dotenv/config";
import { initializeAgent, WalletService } from "./src/agentkit";
import {
  extractJsonFromResponse,
  initializeXmtpClient,
  storage,
  TossStatus,
  type AgentConfig,
  type GroupTossName,
  type ParsedToss,
  type StreamChunk,
  type TossJsonResponse,
  type TransferResponse,
} from "./src/helper";

// Constants
const DEFAULT_OPTIONS = ["yes", "no"];
const DEFAULT_AMOUNT = "1";
const USDC_TOKEN_ADDRESS = "0x5dEaC602762362FE5f135FA5904351916053cF70";
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

class TossManager {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  async getBalance(
    inboxId: string,
  ): Promise<{ address: string | undefined; balance: number }> {
    const balance = await this.walletService.checkBalance(inboxId);
    return { address: balance.address, balance: balance.balance };
  }

  async getPlayerWalletAddress(inboxId: string): Promise<string | undefined> {
    const walletData = await this.walletService.getWallet(inboxId);
    return walletData?.agent_address;
  }

  async createGame(
    creator: string,
    tossAmount: string,
  ): Promise<GroupTossName> {
    const tossId = ((await this.getLastIdToss()) + 1).toString();
    const tossWallet = await this.walletService.createWallet(tossId);

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
    return toss;
  }

  async addPlayerToGame(
    tossId: string,
    player: string,
    chosenOption: string,
    hasPaid: boolean,
  ): Promise<GroupTossName> {
    const toss = await storage.getToss(tossId);
    if (!toss) throw new Error("Toss not found");

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

    if (
      toss.tossOptions &&
      toss.tossOptions.length > 0 &&
      !toss.tossOptions
        .map((opt) => opt.toLowerCase())
        .includes(chosenOption.toLowerCase())
    ) {
      throw new Error(
        `Invalid option: ${chosenOption}. Available options: ${toss.tossOptions.join(", ")}`,
      );
    }

    toss.participants.push(player);
    toss.participantOptions.push({ inboxId: player, option: chosenOption });
    toss.status = TossStatus.WAITING_FOR_PLAYER;

    await storage.updateToss(toss);
    return toss;
  }

  async joinGame(tossId: string, player: string): Promise<GroupTossName> {
    const toss = await storage.getToss(tossId);
    if (!toss) throw new Error("Toss not found");

    if (
      toss.status !== TossStatus.CREATED &&
      toss.status !== TossStatus.WAITING_FOR_PLAYER
    ) {
      throw new Error("Toss is not accepting players");
    }

    if (toss.participants.includes(player)) {
      throw new Error("You are already in this toss");
    }

    return toss;
  }

  async makePayment(
    inboxId: string,
    tossId: string,
    amount: string,
  ): Promise<boolean> {
    const toss = await storage.getToss(tossId);
    if (!toss) throw new Error("Toss not found");

    const transfer = await this.walletService.transfer(
      inboxId,
      toss.walletAddress,
      parseFloat(amount),
    );

    return !!transfer;
  }

  async executeCoinToss(
    tossId: string,
    winningOption: string,
  ): Promise<GroupTossName> {
    const toss = await storage.getToss(tossId);
    if (!toss) throw new Error("Toss not found");

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

    const options = toss.tossOptions?.length
      ? toss.tossOptions
      : [...new Set(toss.participantOptions.map((p) => p.option))];

    if (options.length < 2) {
      throw new Error("Not enough unique options to choose from");
    }

    toss.status = TossStatus.IN_PROGRESS;
    await storage.updateToss(toss);

    const matchingOption = options.find(
      (option) => option.toLowerCase() === winningOption.toLowerCase(),
    );

    if (!matchingOption) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error(`Invalid winning option provided: ${winningOption}`);
    }

    toss.tossResult = matchingOption;

    const winners = toss.participantOptions.filter(
      (p) => p.option.toLowerCase() === matchingOption.toLowerCase(),
    );

    if (!winners.length) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error(`No winners found for option: ${matchingOption}`);
    }

    const totalPot = parseFloat(toss.tossAmount) * toss.participants.length;
    const prizePerWinner = totalPot / winners.length;

    const tossWallet = await this.walletService.getWallet(tossId);
    if (!tossWallet) {
      toss.status = TossStatus.CANCELLED;
      toss.paymentSuccess = false;
      await storage.updateToss(toss);
      throw new Error("Toss wallet not found");
    }

    const successfulTransfers: string[] = [];

    for (const winner of winners) {
      if (!winner.inboxId) continue;

      const winnerWallet = await this.walletService.getWallet(winner.inboxId);
      if (!winnerWallet) continue;

      const transfer = await this.walletService.transfer(
        tossWallet.inboxId,
        winnerWallet.agent_address,
        prizePerWinner,
      );

      if (transfer) {
        successfulTransfers.push(winner.inboxId);

        if (!toss.transactionLink) {
          const transferData = transfer as unknown as TransferResponse;
          toss.transactionLink =
            transferData.model?.sponsored_send?.transaction_link;
        }
      }
    }

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
    const tossesDir = storage.getTossStorageDir();
    const files = await fs.readdir(tossesDir);

    const tossIds = files
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const match = file.match(/^(\d+)-/);
        return match ? parseInt(match[1], 10) : 0;
      });

    return tossIds.length > 0 ? Math.max(...tossIds) : 0;
  }

  async createGameFromPrompt(
    creator: string,
    naturalLanguagePrompt: string,
    agent: ReturnType<typeof createReactAgent>,
    agentConfig: AgentConfig,
  ): Promise<GroupTossName> {
    const parsedToss = await parseNaturalLanguageToss(
      agent,
      agentConfig,
      naturalLanguagePrompt,
    );

    if (typeof parsedToss === "string") {
      throw new Error(parsedToss);
    }

    const toss = await this.createGame(creator, parsedToss.amount);
    toss.tossTopic = parsedToss.topic;
    toss.tossOptions = parsedToss.options;

    await storage.updateToss(toss);
    return toss;
  }
}

// Command handlers
async function handleCommand(
  content: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  const [command, ...args] = content.split(" ");

  // Handle explicit commands first
  switch (command.toLowerCase()) {
    case "join":
      return await handleJoinCommand(args, inboxId, tossManager);
    case "close":
      return await handleCloseCommand(args, inboxId, tossManager);
    case "help":
      return HELP_MESSAGE;
    default:
      return await handleNaturalLanguageCommand(
        content,
        inboxId,
        tossManager,
        agent,
        agentConfig,
      );
  }
}

async function handleJoinCommand(
  args: string[],
  inboxId: string,
  tossManager: TossManager,
): Promise<string> {
  if (args.length < 1) {
    return "Please specify a toss ID and your chosen option: join <tossId> <option>";
  }

  const tossId = args[0];
  const chosenOption = args.length >= 2 ? args[1] : null;

  if (!tossId) {
    return "Please specify a toss ID: join <tossId> <option>";
  }

  const toss = await tossManager.getToss(tossId);
  if (!toss) {
    return `Toss ${tossId} not found.`;
  }

  const joinedToss = await tossManager.joinGame(tossId, inboxId);

  if (!chosenOption) {
    const availableOptions =
      joinedToss.tossOptions && joinedToss.tossOptions.length > 0
        ? joinedToss.tossOptions.join(", ")
        : "yes, no";

    return `Please specify your option when joining: join ${tossId} <option>\nAvailable options: ${availableOptions}`;
  }

  if (
    joinedToss.tossOptions &&
    !joinedToss.tossOptions.some(
      (option) => option.toLowerCase() === chosenOption.toLowerCase(),
    )
  ) {
    return `Invalid option: ${chosenOption}. Available options: ${joinedToss.tossOptions.join(", ")}`;
  }

  const paymentSuccess = await tossManager.makePayment(
    inboxId,
    tossId,
    toss.tossAmount,
  );
  if (!paymentSuccess) {
    return `Payment failed. Please ensure you have enough USDC and try again.`;
  }

  const updatedToss = await tossManager.addPlayerToGame(
    tossId,
    inboxId,
    chosenOption,
    true,
  );
  const playerPosition =
    updatedToss.participants.findIndex((p) => p === inboxId) + 1;
  const playerId = `P${playerPosition}`;

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

async function handleCloseCommand(
  args: string[],
  inboxId: string,
  tossManager: TossManager,
): Promise<string> {
  const tossId = args[0];
  const winningOption = args[1];

  if (!tossId) {
    return "Please specify a toss ID: close <tossId> <option>";
  }

  if (!winningOption) {
    return "Please specify the winning option: close <tossId> <option>";
  }

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

  if (
    toss.tossOptions &&
    !toss.tossOptions.some(
      (option) => option.toLowerCase() === winningOption.toLowerCase(),
    )
  ) {
    return `Invalid option. Please choose one of: ${toss.tossOptions.join(", ")}`;
  }

  try {
    const result = await tossManager.executeCoinToss(tossId, winningOption);

    if (!result.winner) {
      return "The toss failed to determine a winner. Please try again.";
    }

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

    const totalPot = parseFloat(result.tossAmount) * result.participants.length;
    const winnerIds = result.winner ? result.winner.split(",") : [];
    const winningPlayers = playerMap.filter((p) =>
      winnerIds.includes(p.address),
    );
    const prizePerWinner = totalPot / winningPlayers.length;

    // Format result message
    let resultMessage = `🎲 TOSS RESULTS FOR TOSS #${tossId} 🎲\n\n`;

    if (result.tossTopic) {
      resultMessage += `📝 Toss: "${result.tossTopic}"\n`;
      if (result.tossOptions?.length === 2) {
        resultMessage += `🎯 Options: ${result.tossOptions[0]} or ${result.tossOptions[1]}\n\n`;
      }
    }

    resultMessage += `Players (${result.participants.length}):\n`;
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

    resultMessage += `\n💰 Total Pot: ${totalPot} USDC\n`;
    resultMessage += `🎯 Winning Option: ${result.tossResult || "Unknown"}\n\n`;

    if (winningPlayers.length > 0) {
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
      if (result.transactionLink) {
        resultMessage += `\n🔗 Transaction: ${result.transactionLink}`;
      }
    } else {
      resultMessage += `⚠️ Automatic transfer of winnings failed. Please contact support.`;
    }

    return resultMessage;
  } catch (error) {
    return `Error closing toss: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function handleNaturalLanguageCommand(
  prompt: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  const { balance, address } = await tossManager.getBalance(inboxId);
  if (balance < 0.01) {
    return `Insufficient USDC balance. You need at least 0.01 USDC to create a toss. Your balance: ${balance} USDC
Transfer USDC to your wallet address: ${address}`;
  }

  try {
    const toss = await tossManager.createGameFromPrompt(
      inboxId,
      prompt,
      agent,
      agentConfig,
    );

    return `🎲 Toss Created! 🎲

Toss ID: ${toss.id}
Topic: "${toss.tossTopic}"
${toss.tossOptions?.length === 2 ? `Options: ${toss.tossOptions[0]} or ${toss.tossOptions[1]}\n` : ""}
Toss Amount: ${toss.tossAmount} USDC

Other players can join with: join ${toss.id} <option>
When everyone has joined, you can close the toss with: close ${toss.id} <option>`;
  } catch (error) {
    return `Failed to create toss: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Utility functions
async function parseNaturalLanguageToss(
  agent: ReturnType<typeof createReactAgent>,
  config: AgentConfig,
  prompt: string,
): Promise<ParsedToss> {
  const defaultResult: ParsedToss = {
    topic: prompt,
    options: DEFAULT_OPTIONS,
    amount: DEFAULT_AMOUNT,
  };

  if (!prompt || prompt.length < 3) return defaultResult;

  // Extract amount from prompt if it matches pattern "for X"
  const amountMatch = prompt.match(/for\s+(\d+(\.\d+)?)\s*$/i);
  const extractedAmount = amountMatch?.[1] || null;

  // Ask language model to parse the request
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

  try {
    const response = await processMessage(agent, config, parsingRequest);
    const parsedJson = extractJsonFromResponse(response) as TossJsonResponse;

    if (parsedJson.valid === false) {
      throw new Error(`Invalid toss request: ${parsedJson.reason}`);
    }

    return {
      topic: parsedJson.topic ?? prompt,
      options:
        Array.isArray(parsedJson.options) && parsedJson.options.length >= 2
          ? [parsedJson.options[0], parsedJson.options[1]]
          : DEFAULT_OPTIONS,
      amount: extractedAmount || parsedJson.amount || DEFAULT_AMOUNT,
    };
  } catch (error) {
    console.error("Error parsing toss:", error);
    return defaultResult;
  }
}

async function processMessage(
  agent: ReturnType<typeof createReactAgent>,
  config: AgentConfig,
  message: string,
): Promise<string> {
  const stream = await agent.stream(
    { messages: [new HumanMessage(message)] },
    config,
  );

  let response = "";
  for await (const chunk of stream as AsyncIterable<StreamChunk>) {
    if ("agent" in chunk) {
      const content = chunk.agent.messages[0].content;
      if (typeof content === "string") {
        response += content;
      }
    } else if ("tools" in chunk) {
      const content = chunk.tools.messages[0].content;
      if (typeof content === "string") {
        response += content;
      }
    }
  }

  return response.trim();
}

// Message handling for XMTP
export type MessageHandler = (
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) => Promise<void>;

export function extractCommand(content: string): string | null {
  const match = content.match(/@toss\s+(.*)/i);
  return match ? match[1].trim() : null;
}

async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) {
  const tossManager = new TossManager();
  const commandContent = command.trim();
  const inboxId = message.senderInboxId;
  const { agent, config } = await initializeAgent(inboxId, AGENT_INSTRUCTIONS);

  try {
    const response = await handleCommand(
      commandContent,
      inboxId,
      tossManager,
      agent,
      config,
    );
    await conversation.send(response);
  } catch (error) {
    await conversation.send(
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function startMessageListener(
  client: Client,
  handleMessage: MessageHandler,
) {
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    // Skip self-messages or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    const command = extractCommand(message.content as string);
    if (!command) continue;

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    if (!conversation) continue;

    await handleMessage(message, conversation, command);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    const xmtpClient = await initializeXmtpClient();
    await startMessageListener(xmtpClient, handleMessage);
    console.log("CoinToss bot is running and listening for messages");
  } catch (error) {
    console.error("Failed to start CoinToss bot:", error);
  }
}

main().catch(console.error);
