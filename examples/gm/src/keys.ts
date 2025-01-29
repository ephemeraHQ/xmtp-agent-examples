import { getRandomValues } from "node:crypto";
import * as fs from "node:fs";
import path from "path";
import { toHex } from "viem";

export function generateKeys(suffix: string) {
  let encryptionKey =
    process.env["ENCRYPTION_KEY" + suffix] ??
    toHex(getRandomValues(new Uint8Array(32)));

  if (!encryptionKey.startsWith("0x")) {
    encryptionKey = "0x" + encryptionKey;
  }
  let walletKey =
    process.env["WALLET_KEY" + suffix] ??
    toHex(getRandomValues(new Uint8Array(32)));

  if (!walletKey.startsWith("0x")) {
    walletKey = "0x" + walletKey;
  }
  return { walletKey, encryptionKey };
}

export function saveKeys(
  suffix: string,
  walletKey: string,
  encryptionKey: string,
) {
  const envFilePath = path.resolve(process.cwd(), ".env");
  const envContent = `\nENCRYPTION_KEY${suffix}=${encryptionKey}\nWALLET_KEY${suffix}=${walletKey}`;

  // Read the existing .env file content
  let existingEnvContent = "";
  if (fs.existsSync(envFilePath)) {
    existingEnvContent = fs.readFileSync(envFilePath, "utf8");
  }

  // Check if the keys already exist
  if (
    !existingEnvContent.includes(`ENCRYPTION_KEY${suffix}=`) &&
    !existingEnvContent.includes(`WALLET_KEY${suffix}=`)
  ) {
    fs.appendFileSync(envFilePath, envContent);
  }
}
