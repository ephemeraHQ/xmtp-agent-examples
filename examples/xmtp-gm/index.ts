import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";

import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", async (ctx) => {
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.sendText("gm");
  }
});

agent.on("text", async (ctx) => {
  if (ctx.isGroup() && ctx.message.content.includes("@gm")) {
    const senderAddress = await ctx.getSenderAddress();
    console.log(
      `Received message in group: ${ctx.message.content} by ${senderAddress}`,
    );
    await ctx.sendText("gm");
  }
});

agent.on("text", async (ctx) => {
  if (ctx.isGroup() && ctx.message.content.includes("@gm")) {
    const senderAddress = await ctx.getSenderAddress();
    console.log(
      `Received message in group: ${ctx.message.content} by ${senderAddress}`,
    );
    await ctx.sendText("gm");
  }
});

agent.on("group", async (ctx) => {
  // received when you create a new group
  console.log("Added to group:", ctx.conversation.id);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(agent.client.options);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
