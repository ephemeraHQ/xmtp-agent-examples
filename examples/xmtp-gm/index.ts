import fs from "fs";
import { Agent, getTestUrl } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  dbPath: null,
});

agent.on("text", async (ctx) => {
  await ctx.conversation.send("gm");
});

agent.on("dm", (ctx) => {
  console.log("NEw conversation create d with id: ", ctx.conversation.id);
});

agent.on("start", () => {
  console.log(
    `Waiting for messages...`,
    `Address: ${agent.client.accountIdentifier?.identifier}
    🔗${getTestUrl(agent)}`,
  );
});

void agent.start();

function getDbPath(description: string = "xmtp") {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}
