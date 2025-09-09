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
  console.log("New message received: ", ctx.message.content);
  await ctx.conversation.send("gm");
});

agent.on("dm", (ctx) => {
  console.log("New conversation created with id: ", ctx.conversation.id);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();

function getDbPath(description: string = "xmtp") {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}
