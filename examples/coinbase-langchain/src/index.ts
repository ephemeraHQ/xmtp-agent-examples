import "dotenv/config";
import { getAddressOfMember } from "@helpers";
import type { Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { initializeAgent, processMessage } from "./langchain";
import { initializeStorage } from "./storage";
import type { XMTPUser } from "./types";
import { initializeXmtpClient, startMessageListener } from "./xmtp";

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
}

/**
 * Handle incoming messages
 */
async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
) {
  // Use the sender's address as the user ID
  const inboxId = message.senderInboxId;
  const members = await conversation.members();
  const address = getAddressOfMember(members, inboxId);
  if (!address) {
    console.log("Unable to find address, skipping");
    return;
  }
  const xmtpUser: XMTPUser = {
    inboxId,
    address,
  };
  // Initialize or get the agent for this user
  const { agent, config } = await initializeAgent(xmtpUser);

  // Process the message with the agent
  const response = await processMessage(
    agent,
    config,
    message.content as string,
  );

  // Send the response back to the user
  console.log(`Sending response to ${address}...`);
  await conversation.send(response);

  console.log("Waiting for more messages...");
}

async function main(): Promise<void> {
  console.log("Starting agent...");

  // Validate environment variables
  validateEnvironment();

  // Initialize storage (Redis or local)
  await initializeStorage();

  // Initialize XMTP client
  const xmtpClient = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
