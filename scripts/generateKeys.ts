import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey } from "viem/accounts";
import { generateEncryptionKeyHex } from "@/helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("Generating keys...");

const walletKey = generatePrivateKey();
const encryptionKeyHex = generateEncryptionKeyHex();

const filePath = join(".", ".env");

await writeFile(
  filePath,
  `WALLET_KEY=${walletKey}
ENCRYPTION_KEY=${encryptionKeyHex}
`,
);

console.log(`Keys written to ${filePath}`);
