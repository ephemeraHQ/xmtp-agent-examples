import "dotenv/config";
import type { Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { initializeAgent, processMessage } from "./langchain";
import { initializeStorage } from "./storage";
import { initializeXmtpClient, startMessageListener } from "./xmtp";

/**
 * Validates that required environment variables are set
 */
export function validateEnvironment(): {
  coinbaseApiKeyName: string;
  coinbaseApiKeyPrivateKey: string;
  networkId: string;
} {
  const requiredVars = [
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "WALLET_KEY",
    "XMTP_ENV",
    "OPENAI_API_KEY",
    "ENCRYPTION_KEY",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length) {
    console.error("Missing env vars:", missing.join(", "));
    process.exit(1);
  }

  // Replace \\n with actual newlines if present in the private key
  if (process.env.CDP_API_KEY_PRIVATE_KEY) {
    process.env.CDP_API_KEY_PRIVATE_KEY =
      process.env.CDP_API_KEY_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  return {
    coinbaseApiKeyName: process.env.CDP_API_KEY_NAME as string,
    coinbaseApiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY as string,
    networkId: process.env.NETWORK_ID as string,
  };
}

/**
 * Handle incoming messages
 */
async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
) {
  // Initialize or get the agent for this user
  const { agent, config } = await initializeAgent(message.senderInboxId);

  // Process the message with the agent
  const response = await processMessage(
    agent,
    config,
    message.content as string,
  );

  console.log(`Sending response to ${message.senderInboxId}...`);
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
