import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateEncryptionKeyHex } from "@helpers/client";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Check Node.js version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major < 20) {
  console.error("Error: Node.js version 20 or higher is required");
  process.exit(1);
}

console.log("Generating keys for example...");

const walletKey = generatePrivateKey();
const account = privateKeyToAccount(walletKey);
const encryptionKeyHex = generateEncryptionKeyHex();
const publicKey = account.address;

// Get the current working directory (should be the example directory)
const exampleDir = process.cwd();
const exampleName = exampleDir.split("/").pop() || "example";
const filePath = join(exampleDir, ".env");

console.log(`Creating .env file in: ${exampleDir}`);

// Read existing .env file if it exists
let existingEnv = "";
try {
  existingEnv = await readFile(filePath, "utf-8");
  console.log("Found existing .env file");
} catch {
  // File doesn't exist, that's fine
  console.log("No existing .env file found, creating new one");
}

// Check if XMTP_ENV is already set
const xmtpEnvExists = existingEnv.includes("XMTP_ENV=");

const envContent = `# XMTP keys for ${exampleName}
WALLET_KEY=${walletKey}
ENCRYPTION_KEY=${encryptionKeyHex}
${!xmtpEnvExists ? "XMTP_ENV=dev\n" : ""}# public key is ${publicKey}
`;

// Write the .env file to the example directory
await writeFile(filePath, envContent, { flag: "a" });
console.log(`Keys written to ${filePath}`);
console.log(`Public key: ${publicKey}`);
