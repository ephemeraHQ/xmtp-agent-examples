import * as dotenv from "dotenv";
import { initializeStorage as initStorage } from "./storage.js";
import { initializeXmtpClient, startMessageListener } from "./xmtp.js";
import { initializeAgent, processMessage } from "./cdp.js";

// Initialize environment variables
dotenv.config();

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
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

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional variables
  if (!process.env.NETWORK_ID) {
    console.warn(
      "Warning: NETWORK_ID not set, defaulting to base-mainnet"
    );
  }

  if (!process.env.REDIS_URL) {
    console.warn(
      "Warning: REDIS_URL not set, using local file storage for wallet data"
    );
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(message: any, conversation: any) {
  // Use the sender's address as the user ID
  const userId = message.senderInboxId;

  // Initialize or get the agent for this user
  const { agent, config } = await initializeAgent(userId);

  // Process the message with the agent
  const response = await processMessage(
    agent,
    config,
    message.content as string
  );

  // Send the response back to the user
  console.log(`Sending response to ${userId}...`);
  await conversation.send(response);

  console.log("Waiting for more messages...");
}

async function main(): Promise<void> {
  console.log("Starting Payment Agent...");

  // Validate environment variables
  validateEnvironment();

  // Initialize storage (Redis or local)
  await initStorage();

  // Initialize XMTP client
  const { client: xmtpClient } = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
