import {
  AgentKit,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  CdpWalletProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { saveWalletData, getWalletData } from "./storage.js";

// Define types for agent and configuration
interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

// Type for the agent
type Agent = ReturnType<typeof createReactAgent>;

/**
 * Get or create wallet for a user
 */
async function getOrCreateWalletForUser(userId: string) {
  const walletDataStr = await getWalletData(userId);

  let walletProvider;

  // Configure CDP Wallet Provider
  const config = {
    apiKeyName: process.env.CDP_API_KEY_NAME!,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    cdpWalletData: walletDataStr || undefined,
    networkId: process.env.NETWORK_ID || "base-mainnet",
  };

  // Create a new wallet if one doesn't exist
  walletProvider = await CdpWalletProvider.configureWithWallet(config);

  if (!walletDataStr) {
    // Export wallet data and save
    const exportedWallet = await walletProvider.exportWallet();
    await saveWalletData(userId, JSON.stringify(exportedWallet));
  }

  return { walletProvider, config };
}

/**
 * Initialize the agent with CDP Agentkit
 * @param userId - The user's identifier (XMTP address)
 * @returns Agent executor and config
 */
export async function initializeAgent(
  userId: string
): Promise<{ agent: Agent; config: AgentConfig }> {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    // Get or create wallet provider for the user
    const { walletProvider, config: walletConfig } = await getOrCreateWalletForUser(userId);

    // Initialize AgentKit with payment-focused action providers
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME!,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME!,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig: AgentConfig = {
      configurable: { thread_id: `Payment Agent for ${userId}` },
    };

    // Create React Agent using the LLM and CDP AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a DeFi Payment Agent that assists users with sending payments to any wallet address using natural language instructions.

        When a user asks you to make a payment:
        1. Provide clear information about network fees (if any) and transaction status.
        2. Notify users of successful transactions with relevant details.
        
        You can only perform payment-related tasks. For other requests, politely explain that you're 
        specialized in processing payments and can't assist with other tasks.

        Your default currency is USDC and the token address is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913. It's gasless on base-mainnet.
        
        If you encounter an error, provide clear troubleshooting advice and offer to retry the transaction.
        
        Before executing your first action, get the wallet balance to see how much funds you have.
        If you don't have enough funds, ask the user to deposit more funds into your wallet and provide them your wallet address.
        
        If there is a 5XX (internal) HTTP error, ask the user to try again later.
        
        Be concise, helpful, and security-focused in all your interactions.
      `,
    });

    // Export and save updated wallet data
    const exportedWallet = await walletProvider.exportWallet();
    await saveWalletData(userId, JSON.stringify(exportedWallet));

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
  agent: Agent,
  config: AgentConfig,
  message: string
): Promise<string> {
  let response = "";

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      config
    );

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content + "\n";
      } else if ("tools" in chunk) {
        // Tool execution messages can be added to the response or handled separately
        // For now, we'll add them to provide transparency
        response += chunk.tools.messages[0].content + "\n";
      }
    }

    return response.trim();
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
} 