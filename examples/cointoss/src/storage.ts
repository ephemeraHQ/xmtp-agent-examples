import { existsSync, mkdirSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { createClient, type RedisClientType } from "redis";
import { TossStatus, type CoinTossGame, type UserWallet } from "./types";

const networkId = process.env.NETWORK_ID ?? "base-sepolia";
const TOSS_KEY_PREFIX = "toss:";
const WALLET_KEY_PREFIX = "wallet_data:";
const WALLET_STORAGE_DIR = ".data/wallet_data";
const XMTP_STORAGE_DIR = ".data/xmtp";
const TOSS_STORAGE_DIR = ".data/tosses";

/**
 * Generic local file storage for key-value data
 */
class LocalStorage {
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

/**
 * Global storage service that can switch between Redis and local file storage
 */
class StorageService {
  private useRedis: boolean;
  private redisClient: RedisClientType | null = null;
  private tossesStorage: LocalStorage;
  private walletsStorage: LocalStorage;
  private initialized = false;

  constructor() {
    this.useRedis = Boolean(process.env.REDIS_URL);
    this.tossesStorage = new LocalStorage(TOSS_STORAGE_DIR);
    this.walletsStorage = new LocalStorage(WALLET_STORAGE_DIR);
  }

  /**
   * Initialize storage (connect to Redis or ensure local directories)
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.useRedis) {
      this.redisClient = createClient({
        url: process.env.REDIS_URL,
      });

      await this.redisClient.connect();
      console.log("Connected to Redis");
    } else {
      console.log("Using local file storage");
      this.ensureLocalStorage();
    }

    this.initialized = true;
  }

  /**
   * Ensure local storage directories exist
   */
  private ensureLocalStorage(): void {
    if (!existsSync(WALLET_STORAGE_DIR)) {
      mkdirSync(WALLET_STORAGE_DIR, { recursive: true });
    }
    if (!existsSync(TOSS_STORAGE_DIR)) {
      mkdirSync(TOSS_STORAGE_DIR, { recursive: true });
    }
    if (!existsSync(XMTP_STORAGE_DIR)) {
      mkdirSync(XMTP_STORAGE_DIR, { recursive: true });
    }
  }

  /**
   * Save a coin toss game
   */
  public async saveGame(toss: CoinTossGame): Promise<void> {
    if (!this.initialized) await this.initialize();

    if (this.redisClient) {
      const key = `${TOSS_KEY_PREFIX}${toss.id}-${networkId}`;
      await this.redisClient.set(key, JSON.stringify(toss));
    } else {
      await this.tossesStorage.set(toss.id, JSON.stringify(toss, null, 2));
    }
  }

  /**
   * Get a coin toss game by ID
   */
  public async getGame(tossId: string): Promise<CoinTossGame | null> {
    if (!this.initialized) await this.initialize();

    if (this.redisClient) {
      const key = `${TOSS_KEY_PREFIX}${tossId}-${networkId}`;
      const data = await this.redisClient.get(key);
      return data ? (JSON.parse(data) as CoinTossGame) : null;
    } else {
      const data = await this.tossesStorage.get(tossId);
      return data ? (JSON.parse(data) as CoinTossGame) : null;
    }
  }

  /**
   * List all active games
   */
  public async listActiveGames(): Promise<CoinTossGame[]> {
    if (!this.initialized) await this.initialize();

    const tosses: CoinTossGame[] = [];

    if (this.redisClient) {
      const keys = await this.redisClient.keys(`${TOSS_KEY_PREFIX}*`);

      for (const key of keys) {
        const tossId = key
          .replace(TOSS_KEY_PREFIX, "")
          .replace(`-${networkId}`, "");
        const toss = await this.getGame(tossId);
        if (
          toss &&
          toss.status !== TossStatus.COMPLETED &&
          toss.status !== TossStatus.CANCELLED
        ) {
          tosses.push(toss);
        }
      }
    } else {
      try {
        const files = await fs.readdir(TOSS_STORAGE_DIR);

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
      } catch (error) {
        console.error("Error listing active games:", error);
      }
    }

    return tosses;
  }

  /**
   * Update an existing game
   */
  public async updateGame(toss: CoinTossGame): Promise<void> {
    await this.saveGame(toss);
  }

  /**
   * Save user wallet data
   */
  public async saveUserWallet(wallet: UserWallet): Promise<void> {
    if (!this.initialized) await this.initialize();

    if (this.redisClient) {
      const key = `${WALLET_KEY_PREFIX}${wallet.userId}-${networkId}`;
      await this.redisClient.set(key, JSON.stringify(wallet));
    } else {
      await this.walletsStorage.set(
        wallet.userId,
        JSON.stringify(wallet, null, 2),
      );
    }
  }

  /**
   * Get user wallet data by user ID
   */
  public async getUserWallet(userId: string): Promise<UserWallet | null> {
    if (!this.initialized) await this.initialize();

    if (this.redisClient) {
      const key = `${WALLET_KEY_PREFIX}${userId}-${networkId}`;
      const data = await this.redisClient.get(key);
      if (!data) return null;
      return JSON.parse(data) as UserWallet;
    } else {
      const data = await this.walletsStorage.get(userId);
      if (!data) return null;

      try {
        const wallet = JSON.parse(data) as UserWallet;
        return wallet;
      } catch (error) {
        console.error("Error parsing wallet data:", error);
        return null;
      }
    }
  }
}

// Create a single global instance
const storage = new StorageService();

// Export the storage instance
export { storage };

// Export constants for backward compatibility
export {
  TOSS_KEY_PREFIX,
  WALLET_KEY_PREFIX,
  WALLET_STORAGE_DIR,
  XMTP_STORAGE_DIR,
  TOSS_STORAGE_DIR,
};
