import { randomBytes } from "crypto";
import fs from "fs";
import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import { logAgentDetails, validateEnvironment } from "@utils";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { XMTP_ENV, ENCRYPTION_KEY, WALLET_KEY } = validateEnvironment([
  "XMTP_ENV",
  "ENCRYPTION_KEY",
  "WALLET_KEY",
]);

type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
  walletId: string;
  seed: string;
  networkId: string;
};

generateSCW("base-sepolia");

// Later, load it back
const walletData = loadWalletData("wallet.json");
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(walletData?.privateKey as string);

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
export function generateSCW(networkId: string): WalletData {
  // Generate random private key (32 bytes)
  const privateKey = WALLET_KEY;
  // Generate random seed (32 bytes)
  const seed = randomBytes(32).toString("hex");

  // Generate random wallet ID (UUID v4)
  const walletId = crypto.randomUUID();

  // Create account from private key to get the address
  const account = privateKeyToAccount(privateKey as Hex);
  const smartWalletAddress = account.address;

  const walletData = {
    privateKey: privateKey as Hex,
    smartWalletAddress,
    walletId,
    seed,
    networkId,
  };
  // Save it to a file
  try {
    const data = JSON.stringify(walletData, null, 2);
    fs.writeFileSync("wallet.json", data);
    console.log(`Wallet data saved to wallet.json`);
  } catch (error) {
    console.error("Error saving wallet data:", error);
    throw error;
  }

  return walletData;
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
