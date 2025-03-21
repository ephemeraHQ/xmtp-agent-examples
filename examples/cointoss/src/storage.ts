import fs from "fs/promises";
import path from "path";
import { createClient } from "redis";
import {
  TossStatus,
  type CoinTossGame,
  type StorageProvider,
  type UserWallet,
} from "./types";

// Storage provider instance
let storageInstance: StorageProvider | null = null;

/**
 * Initialize the storage provider based on environment variables
 * Uses Redis if REDIS_URL is provided, otherwise falls back to local file storage
 */
export function initializeStorage(): StorageProvider {
  try {
    if (process.env.REDIS_URL) {
      console.log("Initializing Redis storage...");
      storageInstance = new RedisStorageProvider();
      console.log("Redis storage initialized successfully.");
    } else {
      console.log("Initializing local file storage...");
      storageInstance = new LocalStorageProvider();
      console.log("Local file storage initialized successfully.");
    }
  } catch (error) {
    console.error("Failed to initialize storage:", error);
    console.log("Falling back to local file storage...");
    storageInstance = new LocalStorageProvider();
  }

  return storageInstance;
}

/**
 * Generic local file storage for key-value data
 */
export class LocalStorage {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    void this.initDirectory();
  }

  private async initDirectory() {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error("Error creating directory:", error);
    }
  }

  async set(key: string, value: string) {
    try {
      const filePath = path.join(this.baseDir, `${key}.json`);
      await fs.writeFile(filePath, value);
      return true;
    } catch (error) {
      console.error("Error writing to storage:", error);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const filePath = path.join(this.baseDir, `${key}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      return data;
    } catch (error) {
      console.error("Error reading from storage:", error);
      return null;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.baseDir, `${key}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error("Error deleting from storage:", error);
      return false;
    }
  }

  async getWalletCount(): Promise<number> {
    try {
      const files = await fs.readdir(this.baseDir);
      const walletFiles = files.filter(
        (file) => file.startsWith("wallet:") && file.endsWith(".json"),
      );
      return walletFiles.length;
    } catch (error) {
      console.error("Error getting wallet count:", error);
      return 0;
    }
  }
}

export class LocalStorageProvider implements StorageProvider {
  private tossesStorage: LocalStorage;
  private walletsStorage: LocalStorage;

  constructor() {
    this.tossesStorage = new LocalStorage(
      path.join(process.cwd(), "data", "tosses"),
    );
    this.walletsStorage = new LocalStorage(
      path.join(process.cwd(), "wallet_data"),
    );
  }

  async saveGame(toss: CoinTossGame): Promise<void> {
    await this.tossesStorage.set(toss.id, JSON.stringify(toss, null, 2));
  }

  async getGame(tossId: string): Promise<CoinTossGame | null> {
    const data = await this.tossesStorage.get(tossId);
    return data ? (JSON.parse(data) as CoinTossGame) : null;
  }

  async listActiveGames(): Promise<CoinTossGame[]> {
    const tossesDir = path.join(process.cwd(), "data", "tosses");
    const files = await fs.readdir(tossesDir);
    const tosses: CoinTossGame[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const tossId = file.replace(".json", "");
        const toss = await this.getGame(tossId);
        if (
          toss &&
          toss.status !== TossStatus.COMPLETED &&
          toss.status !== TossStatus.CANCELLED
        ) {
          tosses.push(toss);
        }
      }
    }

    return tosses;
  }

  async updateGame(toss: CoinTossGame): Promise<void> {
    await this.saveGame(toss);
  }

  async saveUserWallet(wallet: UserWallet): Promise<void> {
    await this.walletsStorage.set(
      wallet.userId,
      JSON.stringify(wallet, null, 2),
    );
  }

  async getUserWallet(userId: string): Promise<string | null> {
    const data = await this.walletsStorage.get(userId);
    if (!data) return null;

    try {
      const wallet = JSON.parse(data) as UserWallet;
      return wallet.walletData;
    } catch (error) {
      console.error("Error parsing wallet data:", error);
      return null;
    }
  }
}

export class RedisStorageProvider implements StorageProvider {
  private client: ReturnType<typeof createClient>;
  private readonly tossPrefix = "toss:";
  private readonly walletPrefix = "wallet:";

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL,
    });
    void this.client.connect();
  }

  async saveGame(toss: CoinTossGame): Promise<void> {
    await this.client.set(this.tossPrefix + toss.id, JSON.stringify(toss));
  }

  async getGame(tossId: string): Promise<CoinTossGame | null> {
    const data = await this.client.get(this.tossPrefix + tossId);
    return data ? (JSON.parse(data) as CoinTossGame) : null;
  }

  async listActiveGames(): Promise<CoinTossGame[]> {
    const keys = await this.client.keys(this.tossPrefix + "*");
    const tosses: CoinTossGame[] = [];

    for (const key of keys) {
      const toss = await this.getGame(key.replace(this.tossPrefix, ""));
      if (
        toss &&
        toss.status !== TossStatus.COMPLETED &&
        toss.status !== TossStatus.CANCELLED
      ) {
        tosses.push(toss);
      }
    }

    return tosses;
  }

  async updateGame(toss: CoinTossGame): Promise<void> {
    await this.saveGame(toss);
  }

  async saveUserWallet(wallet: UserWallet): Promise<void> {
    await this.client.set(this.walletPrefix + wallet.userId, wallet.walletData);
  }

  async getUserWallet(userId: string): Promise<string | null> {
    return this.client.get(this.walletPrefix + userId);
  }
}
