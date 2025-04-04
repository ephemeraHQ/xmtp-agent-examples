import type { Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { handleCommand } from "./commands";
import { initializeAgent } from "./langchain";
import { TossManager } from "./toss";
import { initializeXmtpClient, startMessageListener } from "./xmtp";

async function handleMessage(
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) {
  try {
    const tossManager = new TossManager();
    const commandContent = command.replace(/^@toss\s+/i, "").trim();
    // Use the sender's address as the user ID
    const inboxId = message.senderInboxId;
    // Initialize or get the agent for this user
    const { agent, config } = await initializeAgent(inboxId);

    const response = await handleCommand(
      commandContent,
      inboxId,
      tossManager,
      agent,
      config,
    );

    await conversation.send(response);
    console.log(`✅ Response sent: ${response.substring(0, 50)}...`);
  } catch (error) {
    console.error("Error:", error);
  }
}
async function main(): Promise<void> {
  console.log("Starting agent...");

  // Initialize XMTP client
  const xmtpClient = await initializeXmtpClient();

  // Start listening for messages
  await startMessageListener(xmtpClient, handleMessage);
}

main().catch(console.error);
