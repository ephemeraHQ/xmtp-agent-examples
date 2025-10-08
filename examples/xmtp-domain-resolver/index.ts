import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";
import { createNameResolver } from "@xmtp/agent-sdk/user";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

// Resolve ENS names or other web3 identities using web3.bio
const resolver = createNameResolver(process.env.WEB3_BIO_API_KEY as string);

agent.on("text", async (ctx) => {
  console.log(`Received message: ${ctx.message.content}`);
  const senderAddress = await ctx.getSenderAddress();
  const content = ctx.message.content.startsWith("0x")
    ? ctx.message.content
    : senderAddress;

  // Reverse resolution
  const name = await resolver(content);
  console.log(`Resolved address`, name);
  await ctx.sendText(`hi ${name}`);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  console.log(`Send an Ethereum address to resolve!`);
});

await agent.start();
