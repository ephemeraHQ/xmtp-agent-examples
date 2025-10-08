import { Agent, AgentError } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

// Helper function to detect if input is an Ethereum address
const isEthereumAddress = (input: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
};

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
  console.log(`Received message: ${ctx.message.content}`);
  const input = isEthereumAddress(ctx.message.content.trim())
    ? ctx.message.content.trim()
    : await ctx.getSenderAddress();

  try {
    // Reverse resolution: address → name
    const results = await fetchFromWeb3Bio(
      input,
      process.env.WEB3_BIO_API_KEY as string,
    );
    console.log(`Resolved address ${input}:`, results);

    if (results.length > 0) {
      // Prioritize Farcaster, then other platforms, exclude generic ethereum addresses
      const sortedResults = results
        .filter((profile) => profile.platform !== "ethereum")
        .sort((a, b) => {
          if (a.platform === "farcaster") return -1;
          if (b.platform === "farcaster") return 1;
          return 0;
        });

      if (sortedResults.length > 0) {
        const names = sortedResults
          .map((profile) => `${profile.identity} (${profile.platform})`)
          .join("\n");
        await ctx.sendText(`Address: ${input}\n\nResolved names:\n${names}`);
      } else {
        await ctx.sendText(`No names found for address: ${input}`);
      }
    } else {
      await ctx.sendText(`No names found for address: ${input}`);
    }
  } catch (error) {
    console.error("Resolution error:", error);
    await ctx.sendText(
      `Sorry, I couldn't resolve the address. Please check the format and try again.`,
    );
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  console.log(`Send an Ethereum address or domain name to resolve!`);
});

await agent.start();
