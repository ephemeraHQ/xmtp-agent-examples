import { createClient } from "redis";
import fs from "fs/promises";
import path from "path";
import { CoinTossGame, StorageProvider, UserWallet } from "./types.js";

// Storage provider instance
let storageInstance: StorageProvider | null = null;

/**
 * Initialize the storage provider based on environment variables
 * Uses Redis if REDIS_URL is provided, otherwise falls back to local file storage
 */
export async function initializeStorage(): Promise<StorageProvider> {
  if (storageInstance) {
    return storageInstance;
  }

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
    this.initDirectory();
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
      const walletFiles = files.filter(file => file.startsWith("wallet:") && file.endsWith(".json"));
      return walletFiles.length;
    } catch (error) {
      console.error("Error getting wallet count:", error);
      return 0;
    }
  }
}

export class LocalStorageProvider implements StorageProvider {
  private gamesStorage: LocalStorage;
  private walletsStorage: LocalStorage;

  constructor() {
    this.gamesStorage = new LocalStorage(path.join(process.cwd(), "data", "games"));
    this.walletsStorage = new LocalStorage(path.join(process.cwd(), "wallet_data"));
  }

  async saveGame(game: CoinTossGame): Promise<void> {
    await this.gamesStorage.set(game.id, JSON.stringify(game, null, 2));
  }

  async getGame(gameId: string): Promise<CoinTossGame | null> {
    const data = await this.gamesStorage.get(gameId);
    return data ? JSON.parse(data) : null;
  }

  async listActiveGames(): Promise<CoinTossGame[]> {
    const gamesDir = path.join(process.cwd(), "data", "games");
    const files = await fs.readdir(gamesDir);
    const games: CoinTossGame[] = [];

    for (const file of files) {
      if (file.endsWith(".json")) {
        const gameId = file.replace(".json", "");
        const game = await this.getGame(gameId);
        if (game && game.status !== "COMPLETED" && game.status !== "CANCELLED") {
          games.push(game);
        }
      }
    }

    return games;
  }

  async updateGame(game: CoinTossGame): Promise<void> {
    await this.saveGame(game);
  }

  async saveUserWallet(wallet: UserWallet): Promise<void> {
    await this.walletsStorage.set(wallet.userId, JSON.stringify(wallet, null, 2));
  }

  async getUserWallet(userId: string): Promise<string | null> {
    const data = await this.walletsStorage.get(userId);
    if (!data) return null;
    
    try {
      const wallet = JSON.parse(data) as UserWallet;
      return wallet.walletData;
    } catch (error) {
      return null;
    }
  }
}

export class RedisStorageProvider implements StorageProvider {
  private client: ReturnType<typeof createClient>;
  private readonly gamePrefix = "game:";
  private readonly walletPrefix = "wallet:";

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL
    });
    this.client.connect();
  }

  async saveGame(game: CoinTossGame): Promise<void> {
    await this.client.set(
      this.gamePrefix + game.id,
      JSON.stringify(game)
    );
  }

  async getGame(gameId: string): Promise<CoinTossGame | null> {
    const data = await this.client.get(this.gamePrefix + gameId);
    return data ? JSON.parse(data) : null;
  }

  async listActiveGames(): Promise<CoinTossGame[]> {
    const keys = await this.client.keys(this.gamePrefix + "*");
    const games: CoinTossGame[] = [];

    for (const key of keys) {
      const game = await this.getGame(key.replace(this.gamePrefix, ""));
      if (game && game.status !== "COMPLETED" && game.status !== "CANCELLED") {
        games.push(game);
      }
    }

    return games;
  }

  async updateGame(game: CoinTossGame): Promise<void> {
    await this.saveGame(game);
  }

  async saveUserWallet(wallet: UserWallet): Promise<void> {
    await this.client.set(
      this.walletPrefix + wallet.userId,
      wallet.walletData
    );
  }

  async getUserWallet(userId: string): Promise<string | null> {
    return this.client.get(this.walletPrefix + userId);
  }
} 