import { Agent, filter, getTestUrl } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");
const path = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "./";

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: (inboxId: string) =>
    path + "/" + process.env.XMTP_ENV + "-" + inboxId.slice(0, 8),
});

agent.on("text", async (ctx) => {
  if (filter.isDM(ctx.conversation)) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.conversation.send("gm");
  }
});

agent.on("text", async (ctx) => {
  if (filter.isGroup(ctx.conversation) && ctx.message.content.includes("@gm")) {
    const senderAddress = await ctx.getSenderAddress();
    console.log(
      `Received message in group: ${ctx.message.content} by ${senderAddress}`,
    );
    await ctx.conversation.send("gm");
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();
