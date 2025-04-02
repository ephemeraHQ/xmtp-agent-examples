import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateEncryptionKeyHex } from "@helpers";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Check Node.js version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major < 20) {
  console.error("Error: Node.js version 20 or higher is required");
  process.exit(1);
}

console.log("Generating keys...");

const walletKey = generatePrivateKey();
const account = privateKeyToAccount(walletKey);
const encryptionKeyHex = generateEncryptionKeyHex();
const publicKey = account.address;

const filePath = join(process.cwd(), ".env");

// Read existing .env file if it exists
let existingEnv = "";
try {
  existingEnv = await readFile(filePath, "utf-8");
} catch {
  // File doesn't exist, that's fine
}

// Check if XMTP_ENV is already set
const xmtpEnvExists = existingEnv.includes("XMTP_ENV=");

const envContent = `\n# generic keys
WALLET_KEY=${walletKey}
ENCRYPTION_KEY=${encryptionKeyHex}
${!xmtpEnvExists ? "XMTP_ENV=dev\n" : ""}# public key is ${publicKey}
`;

await writeFile(filePath, envContent, { flag: "a" });
console.log(`Generic keys written to ${filePath}`);
