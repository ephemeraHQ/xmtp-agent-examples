import {
  AgentKit,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import type { XMTPUser } from "./types";

// Interface for parsed toss information
export interface ParsedToss {
  topic: string;
  options: string[];
  amount: string;
}

// Define stream chunk types
interface AgentChunk {
  agent: {
    messages: Array<{
      content: string;
    }>;
  };
}

interface ToolsChunk {
  tools: {
    messages: Array<{
      content: string;
    }>;
  };
}

type StreamChunk = AgentChunk | ToolsChunk;

// Interface for parsed JSON response
interface TossJsonResponse {
  topic?: string;
  options?: string[];
  amount?: string;
}

// Constants for default values
const DEFAULT_OPTIONS = ["yes", "no"];
const DEFAULT_AMOUNT = "0.1";
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
  - Determine toss amount (default to 0.1 USDC if not specified)
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
  /create <amount> - Create a new coin toss with specified USDC amount
  /join <tossId> - Join an existing toss with the specified ID
  /list - List all active tosses
  /balance - Check your wallet balance
  /help - Show available commands
  
  Before executing any action:
  1. Check if the user has sufficient balance for the requested action
  2. Verify toss exists when joining
  3. Ensure proper toss state transitions
  4. Handle any errors gracefully
  
  Keep responses concise and clear, focusing on payment verification and toss status.
  If there is a 5XX (internal) HTTP error, ask the user to try again later.
`;

export async function initializeAgent(xmtpUser: XMTPUser) {
  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
    });

    const agentkit = await AgentKit.from({
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME ?? "",
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
            /\\n/g,
            "\n",
          ),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME ?? "",
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
            /\\n/g,
            "\n",
          ),
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();

    const agentConfig = {
      configurable: { thread_id: `CoinToss Agent for ${xmtpUser.inboxId}` },
    };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: AGENT_INSTRUCTIONS,
    });

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
  config: { configurable: { thread_id: string } },
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
  config: { configurable: { thread_id: string } },
  prompt: string,
): Promise<ParsedToss> {
  try {
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

    // Format specific request for parsing
    const parsingRequest = `
      Parse this toss request into structured format: "${prompt}"
      
      Return only a valid JSON object with these fields:
      {
        "topic": "the tossing topic",
        "options": ["option1", "option2"],
        "amount": "toss amount"
      }
    `;

    // Process with the agent
    const response = await processMessage(agent, config, parsingRequest);
    const parsedJson = extractJsonFromResponse(response);

    if (parsedJson) {
      // Validate and provide defaults if needed
      const result: ParsedToss = {
        topic: parsedJson.topic ?? prompt,
        options:
          Array.isArray(parsedJson.options) && parsedJson.options.length >= 2
            ? [parsedJson.options[0], parsedJson.options[1]]
            : DEFAULT_OPTIONS,
        amount: parsedJson.amount ?? DEFAULT_AMOUNT,
      };

      console.log(
        `✅ Parsed toss: "${result.topic}" with options [${result.options.join(", ")}] for ${result.amount} USDC`,
      );
      return result;
    }

    return defaultResult;
  } catch (error) {
    console.error("Error parsing natural language toss:", error);
    return {
      topic: prompt,
      options: DEFAULT_OPTIONS,
      amount: DEFAULT_AMOUNT,
    };
  }
}
