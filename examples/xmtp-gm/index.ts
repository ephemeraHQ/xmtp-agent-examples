import { Agent, filter, withFilter } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");
const agent = await Agent.create();

// Combination of filters
const combined = filter.and(filter.textOnly);

agent.on(
  "message",
  withFilter(combined, async (ctx) => {
    await ctx.conversation.send("gm");
  }),
);

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online\nAddress: ${address}\nURL: ${url}`);
});

void agent.start();
