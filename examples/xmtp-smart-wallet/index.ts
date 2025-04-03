import fs from "fs";
import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import { logAgentDetails, validateEnvironment } from "@utils";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import type { Address, Hex } from "viem";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { XMTP_ENV, ENCRYPTION_KEY, NETWORK_ID } = validateEnvironment([
  "XMTP_ENV",
  "ENCRYPTION_KEY",
  "NETWORK_ID",
]);

type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
  walletId: string;
  seed: string;
  networkId: string;
};

// Generate a new random SCW
const walletData = await createSCWallet();

// Later, load it back
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(walletData.privateKey as string);

const main = async () => {
  console.log(`Creating client on the '${XMTP_ENV}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
  });

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  logAgentDetails(address, client.inboxId, XMTP_ENV);

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

async function createSCWallet(): Promise<WalletData> {
  try {
    // Log the network we're using
    console.log(`Creating wallet on network: ${NETWORK_ID}`);

    // Create wallet
    const wallet = await Wallet.create({
      networkId: NETWORK_ID,
    }).catch((err: unknown) => {
      const errorDetails =
        typeof err === "object" ? JSON.stringify(err, null, 2) : err;
      console.error("Detailed wallet creation error:", errorDetails);
      throw err;
    });

    console.log("Wallet created successfully, exporting data...");
    const data = wallet.export();

    console.log("Getting default address...");
    const address = await wallet.getDefaultAddress();
    const walletAddress = address.getId();

    const walletInfo: WalletData = {
      privateKey: wallet.getPrivateKey(),
      smartWalletAddress: walletAddress,
      walletId: wallet.getId(),
      seed: wallet.getSeed(),
      networkId: wallet.getNetworkId(),
    };
    saveWalletData(walletInfo);
    return walletInfo;
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw error;
  }
}

/**
 * Saves wallet data to a JSON file
 * @param walletData - The wallet data to save
 * @param filePath - Path to save the wallet data (default: 'wallet.json')
 */
export function saveWalletData(
  walletData: WalletData,
  filePath: string = "wallet.json",
): void {
  try {
    const data = JSON.stringify(walletData, null, 2);
    fs.writeFileSync(filePath, data);
    console.log(`Wallet data saved to ${filePath}`);
  } catch (error) {
    console.error("Error saving wallet data:", error);
    throw error;
  }
}

/**
 * Loads wallet data from a JSON file
 * @param filePath - Path to load the wallet data from (default: 'wallet.json')
 * @returns WalletData object or null if file doesn't exist
 */
export function loadWalletData(
  filePath: string = "wallet.json",
): WalletData | null {
  try {
    let walletData: WalletData | null = null;
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      walletData = JSON.parse(data) as WalletData;
    }
    return walletData;
  } catch (error) {
    console.error("Error loading wallet data:", error);
    return null;
  }
}

main().catch((error: unknown) => {
  console.error(
    "Unhandled error:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
