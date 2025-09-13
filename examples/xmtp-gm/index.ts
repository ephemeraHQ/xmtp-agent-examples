import { Agent, filter, getTestUrl, withFilter } from "@xmtp/agent-sdk";
import { getDbPath } from "../../utils/general";

process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbPath: getDbPath(),
});

agent.on(
  "text",
  withFilter(filter.isDM, async (ctx) => {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    console.log(`Received message: ${messageContent} by ${senderAddress}`);
    await ctx.conversation.send("gm");
  }),
);

agent.on(
  "text",
  withFilter(
    filter.and(filter.isGroup, filter.startsWith("@gm")),
    async (ctx) => {
      const senderAddress = await ctx.getSenderAddress();
      console.log(
        `Received message in group: ${ctx.message.content} by ${senderAddress}`,
      );
      await ctx.conversation.send("gm");
    },
  ),
);

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

await agent.start();
