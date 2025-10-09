import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";
import {
  resolveMentionsInMessage,
  extractMentions,
  extractMemberAddresses,
  resolveName,
} from "./resolver";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;

  // Extract and resolve mentions
  const mentions = extractMentions(messageContent);
  if (mentions.length > 0) {
    console.log(`Found ${mentions.length} mention(s):`, mentions);

    // Get member addresses if in a group (for matching shortened addresses)
    let memberAddresses: string[] = [];
    if (ctx.isGroup()) {
      try {
        const members = await ctx.conversation.members();
        memberAddresses = extractMemberAddresses(members);
        console.log(`Group has ${memberAddresses.length} members`);
      } catch (error) {
        console.error("Failed to get group members:", error);
      }
    }

    // Resolve all mentions to addresses
    const resolved = await resolveMentionsInMessage(
      messageContent,
      memberAddresses,
    );

    // Build response message
    let response = "🔍 Resolved addresses:\n\n";
    for (const [identifier, address] of Object.entries(resolved)) {
      if (!address) {
        response += `❌ @${identifier} → Not found\n`;
        continue;
      }

      const name = await resolveName(address);
      response += `✅ @${identifier} → ${address}\n`;
      if (name) {
        response += `   Name: ${name}\n`;
      }
    }

    await ctx.sendText(response);

    // Log for debugging
    console.log("Resolved mentions:", JSON.stringify(resolved, null, 2));
  } else {
    console.log("No mentions found");
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  console.log(`Send an Ethereum address or domain name to resolve!`);
});

await agent.start();
