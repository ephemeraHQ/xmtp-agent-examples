import { getRandomValues } from "node:crypto";
import * as fs from "node:fs";
import path from "path";
import { toBytes, toHex } from "viem";

class KeyManager {
  private suffix: string;

  constructor(suffix: string = "") {
    this.suffix = suffix;
  }

  generateKeys(
    walletKey?: string,
    encryptionKey?: string,
  ): {
    walletKey: string;
    encryptionKey: string;
    encryptionKeyBytes: Uint8Array;
  } {
    encryptionKey =
      encryptionKey ??
      process.env["ENCRYPTION_KEY" + this.suffix] ??
      toHex(getRandomValues(new Uint8Array(32)));

    if (!encryptionKey.startsWith("0x")) {
      encryptionKey = "0x" + encryptionKey;
    }
    const encryptionKeyBytes = new Uint8Array(
      toBytes(encryptionKey as `0x${string}`),
    );

    walletKey =
      walletKey ??
      process.env["WALLET_KEY" + this.suffix] ??
      toHex(getRandomValues(new Uint8Array(32)));

    if (!walletKey.startsWith("0x")) {
      walletKey = "0x" + walletKey;
    }
    return { walletKey, encryptionKey, encryptionKeyBytes };
  }

  saveKeys(walletKey: string, encryptionKey: string) {
    const envFilePath = path.resolve(process.cwd(), ".env");
    const envContent = `\nENCRYPTION_KEY${this.suffix}=${encryptionKey}\nWALLET_KEY${this.suffix}=${walletKey}`;

    // Read the existing .env file content
    let existingEnvContent = "";
    if (fs.existsSync(envFilePath)) {
      existingEnvContent = fs.readFileSync(envFilePath, "utf8");
    }

    // Check if the keys already exist
    if (
      !existingEnvContent.includes(`ENCRYPTION_KEY${this.suffix}=`) &&
      !existingEnvContent.includes(`WALLET_KEY${this.suffix}=`)
    ) {
      fs.appendFileSync(envFilePath, envContent);
    }
  }
}

export default KeyManager;
