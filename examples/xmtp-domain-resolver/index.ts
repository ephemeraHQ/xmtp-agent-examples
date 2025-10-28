import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";
import {
  resolveMentionsInMessage,
  fetchFarcasterProfile,
} from "../../utils/resolver";

loadEnvFile();

const agent = await Agent.createFromEnv();

agent.on("text", async (ctx) => {
  const content = ctx.message.content;
  // Resolve all mentions in the message
  const resolved = await resolveMentionsInMessage(
    content,
    await ctx.conversation.members(),
  );

  // Get sender's Farcaster profile
  const senderAddress = await ctx.getSenderAddress();
  const senderProfile = await fetchFarcasterProfile(senderAddress || "");

  if (senderProfile.username) {
    console.log(`Message from Farcaster user: ${senderProfile.username}`);
  }

  // If no mentions found, don't respond
  if (Object.keys(resolved).length === 0) {
    console.log("No mentions found");
    return;
  }
  console.log(resolved);

  // Build response
  let response = "🔍 Resolved:\n\n";

  for (const [identifier, address] of Object.entries(resolved)) {
    if (!address) {
      response += `❌ ${identifier} → Not found\n`;
      continue;
    }

    // Try to get Farcaster username for the resolved address
    const profile = await fetchFarcasterProfile(address);
    if (profile.username) {
      response += `✅ ${identifier} → ${address}\n   👤 Farcaster: ${profile.username}\n\n`;
    } else {
      response += `✅ ${identifier} → ${address}\n\n`;
    }
    console.log(
      identifier,
      address,
      profile.username || "No Farcaster profile",
    );
  }

  await ctx.sendText(response);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

await agent.start();
