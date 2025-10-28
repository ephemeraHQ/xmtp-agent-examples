import { Agent, AgentError } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";
import { resolveMentionsInMessage } from "../../utils/resolver";

loadEnvFile();

const agent = await Agent.createFromEnv();

export const fetchFromWeb3Bio = async (
  name: string,
  apiKey?: string,
): Promise<{ address: string | null }[]> => {
  const endpoint = `https://api.web3.bio/profile/${escape(name)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["X-API-KEY"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new AgentError(
      2000,
      `Could not resolve address for name "${name}": ${response.statusText} (${response.status})`,
    );
  }

  return response.json() as Promise<{ address: string | null }[]>;
};

agent.on("text", async (ctx) => {
  const content = ctx.message.content;
  // Resolve all mentions in the message
  const resolved = await resolveMentionsInMessage(
    content,
    await ctx.conversation.members(),
  );

  const web3BioResolved = await fetchFromWeb3Bio(
    (await ctx.getSenderAddress()) || "",
  );
  console.log(web3BioResolved);
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
