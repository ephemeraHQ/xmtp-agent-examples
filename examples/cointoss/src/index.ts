import "dotenv/config";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { initializeAgent } from "./cdp";
import { handleCommand as processCommand } from "./commands";
import { GameManager } from "./game";
import { initializeStorage } from "./storage";
import type { StorageProvider } from "./types";
import { initializeXmtpClient, startMessageListener } from "./xmtp";

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = [
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "WALLET_KEY",
    "XMTP_ENV",
    "OPENAI_API_KEY",
    "ENCRYPTION_KEY",
  ];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}
// Global CDP agent instance - we'll initialize this at startup for better performance
let cdpAgent: ReturnType<typeof createReactAgent> | null = null;
let cdpAgentConfig: { configurable: { thread_id: string } } | null = null;
let storage: StorageProvider | null = null;

/**
 * Handle incoming messages
 */
async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) {
  try {
    // TODO: Fix this
    const address = message.senderInboxId;
    // Initialize game manager for this request
    const gameManager = new GameManager(storage as StorageProvider, address);

    // Extract command content and process it
    const commandContent = command.replace(/^@toss\s+/i, "").trim();
    const response = await processCommand(
      commandContent,
      address,
      gameManager,
      cdpAgent as ReturnType<typeof createReactAgent>,
      cdpAgentConfig as { configurable: { thread_id: string } },
    );

    await conversation.send(response);
    console.log(
      `✅ Response sent: ${response.substring(0, 100)}${response.length > 100 ? "..." : ""}`,
    );
  } catch (error) {
    console.error("Error handling message:", error);

    const errorMessage = `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
    await conversation.send(errorMessage);
  }
}

async function main(): Promise<void> {
  console.log("Starting CoinToss Agent...");

  // Validate environment variables
  validateEnvironment();

  // Initialize storage at startup
  storage = initializeStorage();

  try {
    // Use a placeholder userId for initial setup
    const initResult = await initializeAgent("SYSTEM_INIT", storage);
    cdpAgent = initResult.agent;
    cdpAgentConfig = initResult.config;
    console.log("✅ CDP agent initialized successfully");
  } catch (error) {
    console.error("Error initializing CDP agent:", error);
    console.warn(
      "⚠️ Will attempt to initialize agent on first message instead",
    );
  }

  // Initialize XMTP client
  const xmtpClient = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
