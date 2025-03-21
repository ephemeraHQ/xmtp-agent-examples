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
import type { ParsedToss, StorageProvider, XMTPUser } from "./types";

export async function getOrCreateWalletForUser(
  humanAddress: string,
  storage: StorageProvider,
) {
  const walletDataStr = await storage.getUserWallet(humanAddress);

  // Configure CDP Wallet Provider
  const config = {
    apiKeyName: process.env.CDP_API_KEY_NAME,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n",
    ),
    cdpWalletData: walletDataStr || undefined,
    networkId: process.env.NETWORK_ID,
  };

  // Create a new wallet if one doesn't exist
  const walletProvider = await CdpWalletProvider.configureWithWallet(config);

  if (!walletDataStr) {
    // Export wallet data and save
    const exportedWallet = await walletProvider.exportWallet();
    await storage.saveUserWallet({
      humanAddress,
      walletData: JSON.stringify(exportedWallet),
    });
  }

  return { walletProvider, config };
}

export async function initializeAgent(
  xmtpUser: XMTPUser,
  storage: StorageProvider,
) {
  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
    });

    const { walletProvider } = await getOrCreateWalletForUser(
      xmtpUser.address,
      storage,
    );

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
            /\\n/g,
            "\n",
          ),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
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
      configurable: { thread_id: `CoinToss Agent for ${xmtpUser.address}` },
    };

    const agent = createReactAgent({
      llm,
      tools: tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a CoinToss Agent that helps users participate in coin toss tossing games.
        
        You have two main functions:
        1. Process natural language toss requests and structure them
        2. Handle coin toss game management commands
        
        When parsing natural language tosses:
        - Extract the toss topic (what people are tossing on)
        - Identify options (default to "yes" and "no" if not provided)
        - Determine toss amount (default to 0.1 USDC if not specified)
        - Enforce a maximum toss amount of 10 USDC
        
        For example:
        - "Will it rain tomorrow for 5" should be interpreted as a toss on "Will it rain tomorrow" with options ["yes", "no"] and amount "5"
        - "Lakers vs Celtics for 10" should be interpreted as a toss on "Lakers vs Celtics game" with options ["Lakers", "Celtics"] and amount "10"
        
        When checking payments or balances:
        1. Use the USDC token at 0x5dEaC602762362FE5f135FA5904351916053cF70 on Base.
        2. When asked to check if a payment was sent, verify:
           - The exact amount was transferred
           - The transaction is confirmed
           - The correct addresses were used
        3. For balance checks, show the exact USDC amount available.
        4. When transferring winnings, ensure:
           - The game wallet has sufficient balance
           - The transfer is completed successfully
           - Provide transaction details
        
        Available commands:
        /create <amount> - Create a new coin toss game with specified USDC toss amount
        /join <gameId> - Join an existing game with the specified ID
        /list - List all active games
        /balance - Check your wallet balance
        /help - Show available commands
        
        Before executing any action:
        1. Check if the user has sufficient balance for the requested action
        2. Verify game exists when joining
        3. Ensure proper game state transitions
        4. Handle any errors gracefully
        
        Keep responses concise and clear, focusing on payment verification and game status.
        If there is a 5XX (internal) HTTP error, ask the user to try again later.
      `,
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
    for await (const chunk of stream) {
      type AgentChunk = { agent: { messages: Array<{ content: string }> } };
      type ToolsChunk = { tools: { messages: Array<{ content: string }> } };

      if ("agent" in chunk) {
        const agentChunk = chunk as AgentChunk;
        if (agentChunk.agent.messages[0]?.content) {
          response += agentChunk.agent.messages[0].content + "\n";
        }
      } else if ("tools" in chunk) {
        const toolsChunk = chunk as ToolsChunk;
        if (toolsChunk.tools.messages[0]?.content) {
          response += toolsChunk.tools.messages[0].content + "\n";
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
  config: { configurable: { thread_id: string } },
  prompt: string,
): Promise<ParsedToss> {
  try {
    // Default values in case parsing fails
    const defaultResult: ParsedToss = {
      topic: prompt,
      options: ["yes", "no"],
      amount: "0.1",
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

    // Try to extract JSON from the response
    try {
      // Find JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Define the expected structure of the parsed JSON
        interface ParsedTossJson {
          topic?: string;
          options?: string[];
          amount?: string;
        }

        const parsedJson = JSON.parse(jsonMatch[0]) as ParsedTossJson;

        // Validate and provide defaults if needed
        const result: ParsedToss = {
          topic: parsedJson.topic || prompt,
          options:
            Array.isArray(parsedJson.options) && parsedJson.options.length >= 2
              ? [parsedJson.options[0], parsedJson.options[1]]
              : ["yes", "no"],
          amount: parsedJson.amount || "0.1",
        };

        console.log(
          `✅ Parsed toss: "${result.topic}" with options [${result.options.join(", ")}] for ${result.amount} USDC`,
        );
        return result;
      }
    } catch (error) {
      console.error("Error parsing JSON from agent response:", error);
    }

    return defaultResult;
  } catch (error) {
    console.error("Error parsing natural language toss:", error);
    return {
      topic: prompt,
      options: ["yes", "no"],
      amount: "0.1",
    };
  }
}
