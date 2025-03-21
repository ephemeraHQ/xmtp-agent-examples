import "dotenv/config";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { handleCommand as processCommand } from "./commands";
import { GameManager } from "./toss";
import { validateEnvironment } from "./types";
import { initializeXmtpClient, startMessageListener } from "./xmtp";

// Global CDP agent
const cdpAgent: ReturnType<typeof createReactAgent> | null = null;
const cdpAgentConfig: { configurable: { thread_id: string } } | null = null;

validateEnvironment();

async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) {
  try {
    const address = message.senderInboxId;
    const gameManager = new GameManager(address);
    const commandContent = command.replace(/^@toss\s+/i, "").trim();

    const response = await processCommand(
      commandContent,
      address,
      gameManager,
      cdpAgent as ReturnType<typeof createReactAgent>,
      cdpAgentConfig as { configurable: { thread_id: string } },
    );

    await conversation.send(response);
    console.log(`✅ Response sent: ${response.substring(0, 50)}...`);
  } catch (error) {
    console.error("Error:", error);
  }
}
async function main(): Promise<void> {
  console.log("Starting agent...");

  // Validate environment variables
  validateEnvironment();

  // Initialize XMTP client
  const xmtpClient = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
