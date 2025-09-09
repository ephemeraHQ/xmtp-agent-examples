import fs from "fs";
import { Agent } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  dbPath: getDbPath(),
});

agent.on("text", async (ctx) => {
  console.log(ctx.message.content);
  await ctx.conversation.send("gm");
});

agent.on("dm", async (ctx) => {
  console.log(ctx.conversation.id);
  await ctx.conversation.send("dm");
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online\nAddress: ${address}\nURL: ${url}`);
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
