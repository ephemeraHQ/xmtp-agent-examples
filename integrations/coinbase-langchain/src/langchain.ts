import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { WalletService } from "./cdp.js";

const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, Agent> = {};

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

type Agent = ReturnType<typeof createReactAgent>;

function createWalletTools(userId: string) {
  const walletService = new WalletService(userId);

  const getBalanceTool = new DynamicStructuredTool({
    name: "get_wallet_balance",
    description: "Get the USDC balance of the current user's wallet. No parameters required as this will check the current user's balance.",
    schema: z.object({}),
    func: async () => {
      try {
        console.log(`Checking balance for fixed userId: ${userId}`);
        const result = await walletService.checkBalance(userId);
        if (!result.address) {
          return `No wallet found for user ${userId}`;
        }
        return `Wallet address: ${result.address}\nUSDC Balance: ${result.balance} USDC`;
      } catch (error) {
        console.error("Error getting balance:", error);
        return `Error checking balance: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const transferUsdcTool = new DynamicStructuredTool({
    name: "transfer_usdc",
    description: "Transfer USDC from the current user's wallet to another wallet address",
    schema: z.object({
      amount: z.string(),
      recipientAddress: z.string(),
    }),
    func: async ({ amount, recipientAddress }) => {
      try {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
          return `Error: Invalid amount ${amount}`;
        }

        console.log(`Transferring from fixed userId: ${userId} to: ${recipientAddress}`);
        const result = await walletService.transfer(userId, recipientAddress, numericAmount);
        if (!result) {
          return "Transfer failed. Please check the logs for more details.";
        }

        const transferData = JSON.parse(JSON.stringify(result));

        if (transferData.model?.sponsored_send?.transaction_link) {
          transferData.transactionLink = transferData.model.sponsored_send.transaction_link;
          console.log(`🔗 Transaction Link: ${transferData.transactionLink}`);
          return `Successfully transferred ${numericAmount} USDC to ${recipientAddress}\n\n${transferData.transactionLink}`;
        }
      } catch (error) {
        console.error("Error transferring USDC:", error);
        return `Error transferring USDC: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return [getBalanceTool, transferUsdcTool];
}

/**
 * Initialize the agent with LangChain and Coinbase SDK
 * @param userId - The user's identifier (XMTP address)
 * @returns Agent executor and config
 */
export async function initializeAgent(
  userId: string
): Promise<{ agent: Agent; config: AgentConfig }> {
  try {
    // Check if we already have an agent for this user
    if (agentStore[userId]) {
      console.log(`Using existing agent for user: ${userId}`);
      const agentConfig = {
        configurable: { thread_id: userId },
      };
      return { agent: agentStore[userId], config: agentConfig };
    }

    console.log(`Creating new agent for user: ${userId}`);

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const tools = createWalletTools(userId);

    if (!memoryStore[userId]) {
      console.log(`Creating new memory store for user: ${userId}`);
      memoryStore[userId] = new MemorySaver();
    } else {
      console.log(`Using existing memory store for user: ${userId}`);
    }

    const agentConfig: AgentConfig = {
      configurable: { thread_id: userId },
    };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memoryStore[userId],
      messageModifier: `
        You are a DeFi Payment Agent that assists users with sending payments to any wallet address using natural language instructions.

        When a user asks you to make a payment, notify them of successful transactions with relevant details.
        Always check wallet balance before making a payment.

        Your default token is USDC on Base Sepolia testnet.

        You can only perform payment-related tasks. For other requests, politely explain that you're 
        specialized in processing payments and can't assist with other tasks.
                
        If you encounter an error, provide clear troubleshooting advice and offer to retry the transaction.
        
        Before executing your first action, get the wallet balance to see how much funds you have.
        If you don't have enough funds, ask the user to deposit more funds into your wallet and provide them your wallet address.
        
        If there is a 5XX (internal) HTTP error, ask the user to try again later.
        
        Be concise, helpful, and security-focused in all your interactions.
      `,
    });

    // Store the agent for future use
    agentStore[userId] = agent;

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
    console.log(`Processing message for user: ${config.configurable.thread_id}`);
    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      config
    );

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content + "\n";
      } 
    }

    return response.trim();
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
} 