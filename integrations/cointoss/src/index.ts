import * as dotenv from "dotenv";
import * as path from "path";
import { initializeStorage } from "./storage.js";
import { initializeXmtpClient, startMessageListener } from "./xmtp.js";
import { initializeAgent } from "./cdp.js";
import { GameManager } from "./game.js";
import { handleCommand as processCommand } from "./commands.js";

// Initialize environment variables - make sure this is at the top of the file before any other code
const envPath = path.resolve(process.cwd(), '.env');
console.log("Loading .env file from:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Error loading .env file:", result.error);
} else {
  console.log("Environment variables loaded from .env file successfully");
}

// Global CDP agent instance - we'll initialize this at startup for better performance
let cdpAgent: any = null;
let cdpAgentConfig: any = null;
let storage: any = null;

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  // Load .env from parent directory
  dotenv.config({ path: '../.env' });
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = [
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "OPENAI_API_KEY",
  ];
  
  // Check Coinbase SDK variables - we need either the COINBASE_ or CDP_ prefixed versions
  const coinbaseApiKeyName = process.env.COINBASE_API_KEY_NAME || process.env.CDP_API_KEY_NAME;
  const coinbaseApiKeyPrivateKey = process.env.COINBASE_API_KEY_PRIVATE_KEY || process.env.CDP_API_KEY_PRIVATE_KEY;
  
  if (!coinbaseApiKeyName) {
    missingVars.push("COINBASE_API_KEY_NAME or CDP_API_KEY_NAME");
  }
  
  if (!coinbaseApiKeyPrivateKey) {
    missingVars.push("COINBASE_API_KEY_PRIVATE_KEY or CDP_API_KEY_PRIVATE_KEY");
  }
  
  // Check other required variables
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
  
  // Log warning about KEY variable
  if (!process.env.KEY) {
    console.warn("Warning: KEY is not set, using ENCRYPTION_KEY for wallet encryption");
  }
  
  return; // Explicit return to satisfy the linter
}

/**
 * Handle incoming messages
 */
async function handleMessage(message: any, conversation: any, userId: string, content: string) {
  try {
    // Get agent address from XMTP client
    const address = message.clientAddress || "unknown";
    
    // Initialize game manager for this request
    const gameManager = new GameManager(storage, address);
  
    // Extract command content and process it
    const commandContent = content.replace(/^@toss\s+/i, "").trim();
    const response = await processCommand(commandContent, userId, gameManager, cdpAgent, cdpAgentConfig);
  
    // Send the response back
    if (conversation) {
      await conversation.send(response);
      console.log(`✅ Response sent: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
    }
  } catch (error) {
    console.error("Error handling message:", error);
    
    // Send error message back to the conversation
    if (conversation) {
      const errorMessage = `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`;
      await conversation.send(errorMessage);
    }
  }
}

async function main(): Promise<void> {
  console.log("Starting CoinToss Agent...");

  // Validate environment variables
  validateEnvironment();
  
  // Initialize storage at startup
  storage = await initializeStorage();
  
  // Initialize the CDP agent at startup for better performance
  if (process.env.OPENAI_API_KEY) {
    console.log("Initializing CDP agent (this might take a moment but will improve message handling speed)...");
    try {
      // Use a placeholder userId for initial setup
      const initResult = await initializeAgent("SYSTEM_INIT", storage);
      cdpAgent = initResult.agent;
      cdpAgentConfig = initResult.config;
      console.log("✅ CDP agent initialized successfully");
    } catch (error) {
      console.error("Error initializing CDP agent:", error);
      console.warn("⚠️ Will attempt to initialize agent on first message instead");
    }
  } else {
    console.warn("⚠️ OPENAI_API_KEY is not set, natural language bet parsing will be disabled");
  }

  // Initialize XMTP client
  const { client: xmtpClient } = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);