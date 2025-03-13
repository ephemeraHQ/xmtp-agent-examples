import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { generateEncryptionKeyHex } from "@/helpers";

console.log("Generating keys...");

const person = process.argv[2];
const walletKey = generatePrivateKey();
const account = privateKeyToAccount(walletKey);
const encryptionKeyHex = generateEncryptionKeyHex();
const publicKey = account.address;

const filePath = join(process.cwd(), ".env");

// Format the environment variables based on whether a person name was provided
let envContent;
if (person) {
  envContent = `# ${person.toLowerCase()}
WALLET_KEY_${person.toUpperCase()}=${walletKey}
ENCRYPTION_KEY_${person.toUpperCase()}=${encryptionKeyHex}
# public key is ${publicKey}
`;
} else {
  envContent = `# generic keys
WALLET_KEY=${walletKey}
ENCRYPTION_KEY=${encryptionKeyHex}
# public key is ${publicKey}
`;
}

await writeFile(filePath, envContent, { flag: "a" });

// Log appropriate message based on whether a person name was provided
if (person) {
  console.log(`Keys for ${person} written to ${filePath}`);
} else {
  console.log(`Generic keys written to ${filePath}`);
}
