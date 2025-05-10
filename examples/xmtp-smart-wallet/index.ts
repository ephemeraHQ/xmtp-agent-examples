import fs from "fs";
import { Coinbase, Wallet, type WalletData } from "@coinbase/coinbase-sdk";
import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

const WALLET_PATH = "wallet.json";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const {
  XMTP_ENV,
  ENCRYPTION_KEY,
  NETWORK_ID,
  CDP_API_KEY_NAME,
  CDP_API_KEY_PRIVATE_KEY,
} = validateEnvironment([
  "XMTP_ENV",
  "ENCRYPTION_KEY",
  "NETWORK_ID",
  "CDP_API_KEY_NAME",
  "CDP_API_KEY_PRIVATE_KEY",
]);

const main = async () => {
  const walletData = await initializeWallet(WALLET_PATH);
  /* Create the signer using viem and parse the encryption key for the local db */
  const signer = createSigner(walletData.seed);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  void logAgentDetails(client);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const addressFromInboxId = inboxState[0].identifiers[0].identifier;
    console.log(`Sending "gm" response to ${addressFromInboxId}...`);
    await conversation.send("gm");

    console.log("Waiting for messages...");
  }
};

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

main().catch(console.error);
