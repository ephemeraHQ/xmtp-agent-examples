import { Agent, filter, withFilter } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");
const agent = await Agent.create();

agent.on("message", async (ctx) => {
  console.log(ctx.message.content);
  await ctx.conversation.send("gm");
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online\nAddress: ${address}\nURL: ${url}`);
});

void agent.start();
