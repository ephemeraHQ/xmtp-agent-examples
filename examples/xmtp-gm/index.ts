import { Agent, getTestUrl } from "@xmtp/agent-sdk";
import { getDbPath } from "../../scripts/utils";

process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: getDbPath(),
});

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;
  const senderAddress = await ctx.getSenderAddress();
  console.log(`Received message: ${messageContent} by ${senderAddress}`);
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
