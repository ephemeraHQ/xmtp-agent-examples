import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";
import {
  resolveMentionsInMessage,
  extractMentions,
  extractMemberAddresses,
} from "../../utils/resolver";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", async (ctx) => {
  const mentions = extractMentions(ctx.message.content);
  if (mentions.length === 0) return;

  // Get group members for shortened address matching
  const memberAddresses = ctx.isGroup()
    ? extractMemberAddresses(await ctx.conversation.members())
    : [];

  // Resolve all mentions
  const resolved = await resolveMentionsInMessage(
    ctx.message.content,
    memberAddresses,
  );

  // Build response
  let response = "🔍 Resolved:\n\n";
  for (const [identifier, address] of Object.entries(resolved)) {
    if (!address) {
      response += `❌ ${identifier} → Not found\n`;
      continue;
    }
    response += `✅ ${identifier} → \${address}\n\n`;
  }

  await ctx.sendText(response);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
