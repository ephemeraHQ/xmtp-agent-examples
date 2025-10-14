import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";
import { resolveMentionsInMessage } from "../../utils/resolver";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", async (ctx) => {
  const content = ctx.message.content;
  // Resolve all mentions in the message
  const resolved = await resolveMentionsInMessage(
    content,
    await ctx.conversation.members(),
  );

  // If no mentions found, don't respond
  if (Object.keys(resolved).length === 0) return;

  // Build response
  let response = "🔍 Resolved:\n\n";
  for (const [identifier, address] of Object.entries(resolved)) {
    if (!address) {
      response += `❌ ${identifier} → Not found\n`;
      continue;
    }
    response += `✅ ${identifier} → ${address}\n\n`;
    console.log(identifier, address);
  }

  await ctx.sendText(response);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
