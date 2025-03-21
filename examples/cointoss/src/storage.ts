import { existsSync, mkdirSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { TossStatus, type CoinTossGame, type UserWallet } from "./types";

const WALLET_STORAGE_DIR = ".data/wallet_data";
const XMTP_STORAGE_DIR = ".data/xmtp";
const TOSS_STORAGE_DIR = ".data/tosses";

/**
 * Storage service for coin toss game data and user wallets
 */
class StorageService {
  private initialized = false;

  constructor() {
    // Initialize directories on creation
    this.initialize();
  }

  /**
   * Initialize storage directories
   */
  public initialize(): void {
    if (this.initialized) return;

    // Ensure storage directories exist
    [WALLET_STORAGE_DIR, TOSS_STORAGE_DIR, XMTP_STORAGE_DIR].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });

    this.initialized = true;
    console.log("Local file storage initialized");
  }

  /**
   * Save data to a JSON file
   */
  private async saveToFile(
    directory: string,
    key: string,
    data: any,
  ): Promise<boolean> {
    try {
      const filePath = path.join(directory, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing to file ${key}:`, error);
      return false;
    }
  }

  /**
   * Read data from a JSON file
   */
  private async readFromFile<T>(
    directory: string,
    key: string,
  ): Promise<T | null> {
    const filePath = path.join(directory, `${key}.json`);
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as T;
  }

  /**
   * Save a coin toss game
   */
  public async saveGame(toss: CoinTossGame): Promise<void> {
    if (!this.initialized) this.initialize();
    await this.saveToFile(TOSS_STORAGE_DIR, toss.id, toss);
  }

  /**
   * Get a coin toss game by ID
   */
  public async getGame(tossId: string): Promise<CoinTossGame | null> {
    if (!this.initialized) this.initialize();
    return this.readFromFile<CoinTossGame>(TOSS_STORAGE_DIR, tossId);
  }

  /**
   * List all active games
   */
  public async listActiveGames(): Promise<CoinTossGame[]> {
    if (!this.initialized) this.initialize();

    const tosses: CoinTossGame[] = [];
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

    return tosses;
  }

  /**
   * Update an existing game (alias for saveGame)
   */
  public async updateGame(toss: CoinTossGame): Promise<void> {
    await this.saveGame(toss);
  }

  /**
   * Save user wallet data
   */
  public async saveUserWallet(wallet: UserWallet): Promise<void> {
    if (!this.initialized) this.initialize();
    await this.saveToFile(WALLET_STORAGE_DIR, wallet.userId, wallet);
  }

  /**
   * Get user wallet data by user ID
   */
  public async getUserWallet(userId: string): Promise<UserWallet | null> {
    if (!this.initialized) this.initialize();
    return this.readFromFile<UserWallet>(WALLET_STORAGE_DIR, userId);
  }

  /**
   * Delete a file
   */
  public async deleteFile(directory: string, key: string): Promise<boolean> {
    try {
      const filePath = path.join(directory, `${key}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${key}:`, error);
      return false;
    }
  }

  /**
   * Get wallet count
   */
  public async getWalletCount(): Promise<number> {
    try {
      const files = await fs.readdir(WALLET_STORAGE_DIR);
      return files.filter((file) => file.endsWith(".json")).length;
    } catch (error) {
      console.error("Error getting wallet count:", error);
      return 0;
    }
  }
}

// Create a single global instance
const storage = new StorageService();

// Export the storage instance
export { storage };

// Export constants for backward compatibility
export { WALLET_STORAGE_DIR, XMTP_STORAGE_DIR, TOSS_STORAGE_DIR };
