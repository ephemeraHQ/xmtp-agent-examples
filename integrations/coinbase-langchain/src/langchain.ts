import { HumanMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { WalletService } from "./cdp";

const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, Agent> = {};

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

type Agent = ReturnType<typeof createReactAgent>;

// Define transfer result structure
interface TransferData {
  model?: {
    sponsored_send?: {
      transaction_link?: string;
    };
  };
  transactionLink?: string;
}

// Define chunk structure for agent stream
interface AgentChunk {
  agent?: {
    messages?: Array<{
      content?: string;
    }>;
  };
}

function createWalletTools(inboxId: string, address: string) {
  // Create a properly typed WalletService instance
  const walletService = new WalletService(inboxId, address);

  const getBalanceTool = new DynamicStructuredTool({
    name: "get_wallet_balance",
    description:
      "Get the USDC balance of the current user's wallet. No parameters required as this will check the current user's balance.",
    schema: z.object({}),
    func: async () => {
      try {
        console.log(`Checking balance for fixed inboxId: ${inboxId}`);
        const result = await walletService.checkBalance(inboxId);
        if (!result.address) {
          return `No wallet found for user ${inboxId}`;
        }
        return `Wallet address: ${result.address}\nUSDC Balance: ${result.balance} USDC`;
      } catch (error: unknown) {
        console.error("Error getting balance:", error);
        return `Error checking balance: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const transferUsdcTool = new DynamicStructuredTool({
    name: "transfer_usdc",
    description:
      "Transfer USDC from the current user's wallet to another wallet address",
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

        console.log(`Transferring from ${address} to: ${recipientAddress}`);

        const result = await walletService.transfer(
          inboxId,
          address,
          recipientAddress,
          numericAmount,
        );

        if (!result) {
          return "Transfer failed. Please check the logs for more details.";
        }

        // Convert to plain object to handle Transfer type from SDK
        const transferData = JSON.parse(JSON.stringify(result)) as TransferData;

        if (transferData.model?.sponsored_send?.transaction_link) {
          transferData.transactionLink =
            transferData.model.sponsored_send.transaction_link;
          console.log(`🔗 Transaction Link: ${transferData.transactionLink}`);
          return `Successfully transferred ${numericAmount} USDC to ${recipientAddress}\n\n${transferData.transactionLink}`;
        }

        return "Transfer initiated but no transaction link was returned.";
      } catch (error: unknown) {
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
  inboxId: string,
  address: string,
): Promise<{ agent: Agent; config: AgentConfig }> {
  try {
    // Check if we already have an agent for this user
    if (inboxId in agentStore) {
      console.log(`Using existing agent for user: ${inboxId}`);
      const agentConfig = {
        configurable: { thread_id: inboxId },
      };
      return { agent: agentStore[inboxId], config: agentConfig };
    }

    console.log(
      `Creating new agent for user with inboxId: ${inboxId} and address: ${address}`,
    );

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const tools = createWalletTools(inboxId, address);

    if (!(inboxId in memoryStore)) {
      console.log(`Creating new memory store for user: ${inboxId}`);
      memoryStore[inboxId] = new MemorySaver();
    } else {
      console.log(`Using existing memory store for user: ${inboxId}`);
    }

    const agentConfig: AgentConfig = {
      configurable: { thread_id: inboxId },
    };

    // Make sure we await the agent creation
    const agent = await Promise.resolve(
      createReactAgent({
        llm,
        tools,
        checkpointSaver: memoryStore[inboxId],
        messageModifier: `
        You are a DeFi Agent that assists users with sending payments to any wallet address using natural language instructions.

        Instructions:
        - When a user asks you to make a payment, notify them of successful transactions with relevant details.
        - Always check wallet balance before making a payment.
        - Your default token is USDC
        - You can only perform payment-related tasks. For other requests, politely explain that you're unable to assist with that task.
        - If the user asks for the wallet address, provide it and nothing more. Just the address. no wrappers.
    
        Managing your wallet:
        - Before executing your first action, get the wallet balance to see how much funds you have.
        - When you send the wallet be sure you send it with a new line character before the wallet address.
        - If you don't have enough funds, ask the user to deposit more funds into your wallet and provide them your wallet address.
        
        Error handling:
        - If there is a 5XX (internal) HTTP error, ask the user to try again later.
        - If you encounter an error, provide clear troubleshooting advice and offer to retry the transaction.
        
        Be concise, helpful, and security-focused in all your interactions.
      `,
      }),
    );

    // Store the agent for future use
    agentStore[inboxId] = agent;

    return { agent, config: agentConfig };
  } catch (error: unknown) {
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
  message: string,
): Promise<string> {
  let response = "";

  try {
    console.log(
      `Processing message for user: ${config.configurable.thread_id}`,
    );
    const stream = await agent.stream(
      { messages: [new HumanMessage(message)] },
      config,
    );

    for await (const chunk of stream) {
      const typedChunk = chunk as AgentChunk;
      if ("agent" in typedChunk && typedChunk.agent?.messages?.[0]?.content) {
        const content = String(typedChunk.agent.messages[0].content);
        response += content + "\n";
      }
    }

    return response.trim();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing message:", errorMessage);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
}
