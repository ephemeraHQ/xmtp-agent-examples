import fs from "fs";
import { Coinbase, Wallet, type WalletData } from "@coinbase/coinbase-sdk";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
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

const walletData = await initializeWallet(WALLET_PATH);
/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(walletData.seed || "");
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

// Log connection details
const identifier = await signer.getIdentifier();
const address = identifier.identifier;
console.log(`Smart Wallet Address: ${address}`);
const main = async () => {
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
  });

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  logAgentDetails(address, client.inboxId, XMTP_ENV);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
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

main().catch((error: unknown) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
