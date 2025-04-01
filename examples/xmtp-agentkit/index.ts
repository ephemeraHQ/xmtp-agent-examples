import * as fs from "fs";
import {
  AgentKit,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  CdpWalletProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Client, type DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";
import * as dotenv from "dotenv";

// Initialize environment variables
dotenv.config();

// Storage constants
const XMTP_STORAGE_DIR = ".data/";

// Global stores for memory and agent instances
const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, Agent> = {};

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

type Agent = ReturnType<typeof createReactAgent>;

/**
 * Ensure local storage directory exists
 */
function ensureLocalStorage() {
  if (!fs.existsSync(XMTP_STORAGE_DIR)) {
    fs.mkdirSync(XMTP_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Save wallet data to storage.
 *
 * @param userId - The unique identifier for the user
 * @param walletData - The wallet data to be saved
 */
function saveWalletData(userId: string, walletData: string) {
  const localFilePath = `${XMTP_STORAGE_DIR}/${userId}.json`;
  try {
    fs.writeFileSync(localFilePath, walletData);
  } catch (error) {
    console.error(`Failed to save wallet data to file: ${error as string}`);
  }
}

/**
 * Get wallet data from storage.
 *
 * @param userId - The unique identifier for the user
 * @returns The wallet data as a string, or null if not found
 */
function getWalletData(userId: string): string | null {
  const localFilePath = `${XMTP_STORAGE_DIR}/${userId}.json`;
  try {
    if (fs.existsSync(localFilePath)) {
      return fs.readFileSync(localFilePath, "utf8");
    }
  } catch (error) {
    console.warn(`Could not read wallet data from file: ${error as string}`);
  }
  return null;
}
/**
 * Initialize the XMTP client.
 *
 * @returns An initialized XMTP Client instance
 */
async function initializeXmtpClient() {
  const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = process.env;

  if (!WALLET_KEY || !ENCRYPTION_KEY || !XMTP_ENV) {
    throw new Error(
      "Some environment variables are not set. Please check your .env file.",
    );
  }

  const signer = createSigner(WALLET_KEY);
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const env: XmtpEnv = XMTP_ENV as XmtpEnv;

  console.log(`Creating XMTP client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, { env });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;

  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}?env=${env}`,
  );

  return client;
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
    // Always create a new agent for each user
    console.log(`Creating new agent for user: ${userId}`);

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const storedWalletData = getWalletData(userId);
    console.log(
      `Wallet data for ${userId}: ${storedWalletData ? "Found" : "Not found"}`,
    );

    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n",
      ),
      cdpWalletData: storedWalletData || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

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

    // Always create a new memory store for each user
    console.log(`Creating new memory store for user: ${userId}`);
    memoryStore[userId] = new MemorySaver();

    const agentConfig: AgentConfig = {
      configurable: { thread_id: userId },
    };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memoryStore[userId],
      messageModifier: `
        You are a DeFi Payment Agent that assists users with sending payments and managing their crypto assets.
        You can interact with the blockchain using Coinbase Developer Platform AgentKit.

        When a user asks you to make a payment or check their balance:
        1. Always check the wallet details first to see what network you're on
        2. If on base-sepolia testnet, you can request funds from the faucet if needed
        3. For mainnet operations, provide wallet details and request funds from the user

        Your default network is Base Sepolia testnet.
        Your main and only token for transactions is USDC. Token address is 0x036CbD53842c5426634e7929541eC2318f3dCF7e. USDC is gasless on Base.

        You can only perform payment and wallet-related tasks. For other requests, politely explain that you're 
        specialized in processing payments and can't assist with other tasks.
                
        If you encounter an error:
        - For 5XX errors: Ask the user to try again later
        - For other errors: Provide clear troubleshooting advice and offer to retry
        
        Be concise, helpful, and security-focused in all your interactions.
      `,
    });

    agentStore[userId] = agent;

    const exportedWallet = await walletProvider.exportWallet();
    const walletDataJson = JSON.stringify(exportedWallet);
    saveWalletData(userId, walletDataJson);
    console.log(`Wallet data saved for user ${userId}`);

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
async function handleMessage(message: DecodedMessage, client: Client) {
  try {
    const senderAddress = message.senderInboxId;
    const botAddress = client.inboxId.toLowerCase();

    console.log(`Received message from ${senderAddress}: ${message.content}`);
    // Ignore messages from the bot itself
    if (senderAddress.toLowerCase() === botAddress) {
      return;
    }

    console.log(`Received message from ${senderAddress}: ${message.content}`);

    const { agent, config } = await initializeAgent(senderAddress);
    const response = await processMessage(
      agent,
      config,
      String(message.content),
    );

    // Get the conversation and send response
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    if (!conversation) {
      throw new Error(
        `Could not find conversation for ID: ${message.conversationId}`,
      );
    }
    await conversation.send(response);
    console.log(`Sent response to ${senderAddress}: ${response}`);
  } catch (error) {
    console.error("Error handling message:", error);
    // Send error message back to user
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );
    if (!conversation) {
      console.error(
        `Could not find conversation for ID: ${message.conversationId}`,
      );
      return;
    }
    await conversation.send(
      "I encountered an error while processing your request. Please try again later.",
    );
  }
}

/**
 * Start listening for XMTP messages.
 *
 * @param client - The XMTP client instance
 */
async function startMessageListener(client: Client) {
  console.log("Starting message listener...");
  const stream = await client.conversations.streamAllMessages();
  for await (const message of stream) {
    if (message) {
      await handleMessage(message, client);
    }
  }
}

/**
 * Validates that required environment variables are set.
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "WALLET_KEY",
    "ENCRYPTION_KEY",
  ];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia");
  }
}

/**
 * Main function to start the chatbot.
 */
async function main(): Promise<void> {
  console.log("Initializing Agent on XMTP...");

  validateEnvironment();
  ensureLocalStorage();

  const xmtpClient = await initializeXmtpClient();
  await startMessageListener(xmtpClient);
}

// Start the chatbot
main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
