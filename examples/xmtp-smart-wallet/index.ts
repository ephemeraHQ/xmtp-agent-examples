import fs from "fs";
import { Coinbase, Wallet, type WalletData } from "@coinbase/coinbase-sdk";
import { Agent } from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const WALLET_PATH = "wallet.json";
const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME || "";
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY || "";
const NETWORK_ID = process.env.NETWORK_ID || "base-sepolia";

const walletData = await initializeWallet(WALLET_PATH);
/* Create the signer using viem and parse the encryption key for the local db */
const user = createUser(walletData.seed as `0x${string}`);
const signer = createSigner(user);
const agent = await Agent.create(signer, {
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});
void agent.start();
agent.on("text", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();

  console.log(`Sending "gm" response to ${senderAddress}...`);
  await ctx.sendText("gm");
});

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
