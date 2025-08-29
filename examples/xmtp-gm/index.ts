import { Agent, filter as f, withFilter } from "@xmtp/agent-sdk";

const agent = await Agent.create();

agent.on("message", (ctx) => {
  console.log("Got message:", ctx.message.content);
  void ctx.conversation.send("gm");
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online: ${url}`);
});

void agent.start();
