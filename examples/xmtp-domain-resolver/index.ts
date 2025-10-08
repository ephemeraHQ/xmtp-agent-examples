import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { loadEnvFile } from "../../utils/general";
import { createNameResolver } from "@xmtp/agent-sdk/user";

loadEnvFile();

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

// Resolve ENS names or other web3 identities using web3.bio
const resolver = createNameResolver(process.env.WEB3_BIO_API_KEY as string);
const address = await resolver("vitalik.eth");
console.log(`Resolved address: ${address}`);

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content.trim();
  const senderAddress = await ctx.getSenderAddress();

  console.log(`Received message: ${messageContent} from ${senderAddress}`);

  // Handle ENS name resolution
  if (isENSName(messageContent)) {
    await ctx.sendText("🔍 Resolving ENS name...");

    const resolvedAddress = await resolveENS(messageContent);

    if (resolvedAddress) {
      await ctx.sendText(
        `✅ ${messageContent} resolves to:\n${resolvedAddress}`,
      );
    } else {
      await ctx.sendText(
        `❌ Could not resolve ${messageContent}. Make sure it's a valid ENS name.`,
      );
    }
    return;
  }

  // Handle address reverse resolution
  if (isAddress(messageContent)) {
    await ctx.sendText("🔍 Looking up domain for address...");

    const ensName = await reverseResolveENS(messageContent);

    if (ensName) {
      await ctx.sendText(
        `✅ Address ${messageContent} is registered as:\n${ensName}`,
      );
    } else {
      await ctx.sendText(`❌ No ENS name found for ${messageContent}`);
    }
    return;
  }

  // Help message
  await ctx.sendText(
    `👋 Send me an ENS name (like vitalik.eth) to resolve it to an address, or send an Ethereum address to find its ENS name!`,
  );
});

agent.on("start", () => {
  console.log(`Domain Resolver Agent is running...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
  console.log(`Send an ENS name or Ethereum address to resolve!`);
});

await agent.start();
