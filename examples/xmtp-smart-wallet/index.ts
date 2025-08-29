import fs from "fs";
import { Coinbase, Wallet, type WalletData } from "@coinbase/coinbase-sdk";
import { Agent } from "@xmtp/agent-sdk";

const WALLET_PATH = "wallet.json";

const NETWORK_ID = process.env.NETWORK_ID || "base-sepolia";
const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME || "";
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY || "";

  const walletData = await initializeWallet(WALLET_PATH);
  
    const agent = await Agent.create(undefined, {
    walletKey: walletData.seed,
    dbEncryptionKey: process.env.XMTP_DB_ENCRYPTION_KEY,
  });

  agent.on("message", async (ctx) => {
    const inboxState = await agent.client.preferences.inboxStateFromInboxIds([
      ctx.message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0]?.identifiers[0]?.identifier;
    console.log(`Sending "gm" response to ${addressFromInboxId}...`);
    await ctx.conversation.send("gm");
  });

  agent.on("start", () => {
    const address = agent.client.accountIdentifier?.identifier;
    const env = agent.client.options?.env;
    const url = `http://xmtp.chat/dm/${address}?env=${env}`;
    console.log(`We are online: ${url}`);
  });

  await agent.start();
});

/**
 * Generates a random Smart Contract Wallet
 * @param networkId - The network ID (e.g., 'base-sepolia', 'base-mainnet')
 * @returns WalletData object containing all necessary wallet information
 */

async function initializeWallet(walletPath: string): Promise<WalletData> {
  try {
    let walletData: WalletData | null = null;
    if (fs.existsSync(walletPath)) {
      const data = fs.readFileSync(walletPath, "utf8");
      walletData = JSON.parse(data) as WalletData;
      return walletData;
    } else {
      console.log(`Creating wallet on network: ${NETWORK_ID}`);
      Coinbase.configure({
        apiKeyName: CDP_API_KEY_NAME,
        privateKey: CDP_API_KEY_PRIVATE_KEY,
      });
      const wallet = await Wallet.create({
        networkId: NETWORK_ID,
      });

      console.log("Wallet created successfully, exporting data...");
      const data = wallet.export();
      console.log("Getting default address...");
      const walletInfo: WalletData = {
        seed: data.seed || "",
        walletId: wallet.getId() || "",
        networkId: wallet.getNetworkId(),
      };

      fs.writeFileSync(walletPath, JSON.stringify(walletInfo, null, 2));
      console.log(`Wallet data saved to ${walletPath}`);
      return walletInfo;
    }
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw error;
  }
}

void main().catch((error) => {
  console.error("Error starting agent:", error);
  process.exit(1);
    
});   
