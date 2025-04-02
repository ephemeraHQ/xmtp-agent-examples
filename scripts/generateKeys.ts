import { writeFile } from "node:fs/promises";
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

const envContent = `# generic keys
WALLET_KEY=${walletKey}
ENCRYPTION_KEY=${encryptionKeyHex}
# public key is ${publicKey}
`;

await writeFile(filePath, envContent, { flag: "a" });
console.log(`Generic keys written to ${filePath}`);
