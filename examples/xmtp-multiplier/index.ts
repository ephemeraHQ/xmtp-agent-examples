import fs from "fs";
import { Agent, createSigner, createUser, getTestUrl } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");

const agent = await Agent.create(
  createSigner(createUser(process.env.XMTP_WALLET_KEY as `0x${string}`)),
  {
    env: process.env.XMTP_ENV as "local" | "dev" | "production",
    dbPath: getDbPath(),
  },
);

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content.trim();
  console.log("New message received: ", messageContent);

  try {
    // Parse the message to extract two numbers
    const result = parseAndMultiply(messageContent);
    await ctx.conversation.send(result);
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.conversation.send(
      "Please send two numbers separated by space, comma, or 'x'. Examples: '5 3', '5,3', '5 x 3', 'multiply 5 and 3'",
    );
  }
});

agent.on("dm", (ctx) => {
  console.log("New conversation created with id: ", ctx.conversation.id);
});

agent.on("start", () => {
  console.log(`Multiplication Agent is running...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
  console.log(`Send me two numbers to multiply!`);
});

await agent.start();

function parseAndMultiply(message: string): string {
  // Remove common words and clean the message
  const cleanMessage = message
    .toLowerCase()
    .replace(/multiply|times|by|and|the|numbers?/g, "")
    .trim();

  // Try different patterns to extract two numbers
  let numbers: number[] = [];

  // Pattern 1: "5 x 3" or "5x3"
  let match = cleanMessage.match(/(\d+(?:\.\d+)?)\s*[x*×]\s*(\d+(?:\.\d+)?)/);
  if (match) {
    numbers = [parseFloat(match[1]), parseFloat(match[2])];
  }

  // Pattern 2: "5, 3" or "5,3"
  if (numbers.length === 0) {
    match = cleanMessage.match(/(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
    if (match) {
      numbers = [parseFloat(match[1]), parseFloat(match[2])];
    }
  }

  // Pattern 3: "5 3" (space separated)
  if (numbers.length === 0) {
    match = cleanMessage.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/);
    if (match) {
      numbers = [parseFloat(match[1]), parseFloat(match[2])];
    }
  }

  // Pattern 4: Extract any two numbers from the message
  if (numbers.length === 0) {
    const allNumbers = cleanMessage.match(/\d+(?:\.\d+)?/g);
    if (allNumbers && allNumbers.length >= 2) {
      numbers = [parseFloat(allNumbers[0]), parseFloat(allNumbers[1])];
    }
  }

  if (numbers.length < 2) {
    throw new Error("Could not find two numbers to multiply");
  }

  const result = numbers[0] * numbers[1];
  return `${numbers[0]} × ${numbers[1]} = ${result}`;
}

function getDbPath(description: string = "xmtp") {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}
