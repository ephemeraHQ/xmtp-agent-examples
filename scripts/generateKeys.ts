import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex } from "@/helpers";

console.log("Generating keys...");

const walletKey = generatePrivateKey();
const encryptionKeyHex = generateEncryptionKeyHex();

const filePath = join(process.cwd(), ".env");

await writeFile(
  filePath,
  `WALLET_KEY=${walletKey}
ENCRYPTION_KEY=${encryptionKeyHex}
`,
);

console.log(`Keys written to ${filePath}`);
