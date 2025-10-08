import { Agent, AgentError } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

// Web3.bio API response type
interface Web3BioProfile {
  address: string | null;
  identity: string;
  platform: string;
  displayName: string;
  avatar: string;
  description: string | null;
}

// Reverse resolution: address → name using Web3.bio API
const fetchFromWeb3Bio = async (
  identifier: string,
  apiKey?: string,
): Promise<Web3BioProfile[]> => {
  const endpoint = `https://api.web3.bio/ns/${identifier}`;
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
      `Could not resolve identifier "${identifier}": ${response.statusText} (${response.status})`,
    );
  }

  return response.json() as Promise<Web3BioProfile[]>;
};

agent.on("text", async (ctx) => {
  const input = await ctx.getSenderAddress();
  const results = await fetchFromWeb3Bio(input);
  // Prioritize Farcaster, then other platforms, exclude generic ethereum addresses
  const farcasterResults = results
    .filter((profile) => profile.platform === "farcaster")
    .sort((a, b) => {
      return a.displayName.localeCompare(b.displayName);
    });
  const names = farcasterResults.map((result) => result.identity).join("\n");
  await ctx.sendText(`Hi 👋🏼! ${names}`);
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  console.log(`Send an Ethereum address or domain name to resolve!`);
});

await agent.start();
