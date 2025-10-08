import * as fs from "fs";
import {
  AgentKit,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  CdpEvmWalletProvider,
  erc20ActionProvider,
  pythActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Agent as XMTPAgent, type MessageContext } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();
// Storage constants
const XMTP_STORAGE_DIR = ".data/xmtp";
const WALLET_STORAGE_DIR = ".data/wallet";

// Global stores for memory and agent instances
const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, Agent> = {};

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

interface WalletData {
  name?: string;
  address: `0x${string}`;
}

type Agent = ReturnType<typeof createReactAgent>;

/**
 * Ensure local storage directory exists
 */
function ensureLocalStorage() {
  if (!fs.existsSync(XMTP_STORAGE_DIR)) {
    fs.mkdirSync(XMTP_STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(WALLET_STORAGE_DIR)) {
    fs.mkdirSync(WALLET_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Save wallet data to storage.
 *
 * @param userId - The unique identifier for the user
 * @param walletData - The wallet data to be saved
 */
function saveWalletData(userId: string, walletData: WalletData): void {
  const localFilePath = `${WALLET_STORAGE_DIR}/${userId}.json`;
  if (fs.existsSync(localFilePath)) return;
  try {
    fs.writeFileSync(localFilePath, JSON.stringify(walletData, null, 2));
    console.log(`Wallet data saved for user ${userId}`);
  } catch (error) {
    console.error(`Failed to save wallet data to file: ${error as string}`);
  }
}

/**
 * Get wallet data from storage.
 *
 * @param userId - The unique identifier for the user
 * @returns The wallet data, or null if not found
 */
function getWalletData(userId: string): WalletData | null {
  const localFilePath = `${WALLET_STORAGE_DIR}/${userId}.json`;
  try {
    if (fs.existsSync(localFilePath)) {
      return JSON.parse(fs.readFileSync(localFilePath, "utf8"));
    }
  } catch (error) {
    console.warn(`Could not read wallet data from file: ${error as string}`);
  }
  return null;
}

/**
 * Initialize the agent with CDP Agentkit.
 *
 * @param userId - The unique identifier for the user
 * @returns The initialized agent and its configuration
 */
async function initializeAgent(
  userId: string,
): Promise<{ agent: Agent; config: AgentConfig }> {
  try {
    if (agentStore[userId]) {
      const agentConfig = {
        configurable: { thread_id: userId },
      };
      return { agent: agentStore[userId], config: agentConfig };
    }

    const llm = new ChatOpenAI({
      model: "gpt-4.1-mini",
      apiKey: process.env.OPENAI_API_KEY || "",
    });

    const storedWalletData = getWalletData(userId);

    console.log(
      `Creating new agent for user: ${userId}, wallet data: ${storedWalletData ? "Found" : "Not found"}`,
    );

    // Configure CDP Wallet Provider with CDP v2
    const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
      idempotencyKey: process.env.IDEMPOTENCY_KEY,
      address: storedWalletData?.address,
      networkId: process.env.NETWORK_ID || "base-sepolia",
      rpcUrl: process.env.RPC_URL,
    });

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider(),
        cdpEvmWalletActionProvider(),
        pythActionProvider(),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    if (!memoryStore[userId]) {
      memoryStore[userId] = new MemorySaver();
    }

    const agentConfig: AgentConfig = {
      configurable: { thread_id: userId },
    };

    const canUseFaucet = walletProvider.getNetwork().networkId == "base-sepolia";
    const faucetMessage = `If you ever need funds, you can request them from the faucet.`;
    const cantUseFaucetMessage = `If you need funds, you can provide your wallet details and request funds from the user.`;

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memoryStore[userId],
      messageModifier: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. 
        Before executing your first action, get the wallet details to see your address and what network you're on. 
        ${canUseFaucet ? faucetMessage : cantUseFaucetMessage}.
        If someone asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.
      `,
    });

    agentStore[userId] = agent;

    const exportedWallet = await walletProvider.exportWallet();
    saveWalletData(userId, exportedWallet);

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Process a message with the agent.
 *
 * @param agent - The agent instance to process the message
 * @param config - The agent configuration
 * @param message - The message to process
 * @returns The processed response as a string
 */
async function processMessage(
  agent: Agent,
  config: AgentConfig,
  message: string,
): Promise<string> {
  let response = "";

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      config,
    );

    for await (const chunk of stream) {
      if (chunk && typeof chunk === "object" && "agent" in chunk) {
        const agentChunk = chunk as {
          agent: { messages: Array<{ content: unknown }> };
        };
        response += String(agentChunk.agent.messages[0].content) + "\n";
      }
    }

    return response.trim();
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
}

/**
 * Handle incoming XMTP messages.
 *
 * @param message - The decoded XMTP message
 * @param client - The XMTP client instance
 */
async function handleMessage(ctx: MessageContext) {
  try {
    const userId = ctx.message.senderInboxId;
    console.log(`Received message from ${userId}: ${ctx.message.content}`);

    const { agent, config } = await initializeAgent(userId);
    const response = await processMessage(
      agent,
      config,
      String(ctx.message.content),
    );

    await ctx.sendText(response);
    console.debug(`Sent response to ${ctx.message.senderInboxId}: ${response} \n`);
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.sendText(
      "I encountered an error while processing your request. Please try again later.",
    );
  }
}

console.log("Initializing Agent on XMTP...");

ensureLocalStorage();

const agent = await XMTPAgent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", (ctx) => {
  void handleMessage(ctx);
});

agent.on("start", () => {
  console.log(`Address: ${agent.address}`);
  console.log(`Start a conversation at 🔗${getTestUrl(agent.client)}`);
  console.log(`Waiting for messages... \n`);
});

void agent.start();
