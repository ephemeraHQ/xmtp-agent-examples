import * as fs from "fs";
import { createClient } from "redis";

// Storage constants
export const WALLET_KEY_PREFIX = "wallet_data:";
export const LOCAL_STORAGE_DIR = "./wallet_data";
export let redisClient: any = null;

/**
 * Initialize Redis client and handle fallback to local storage
 */
export async function initializeStorage() {
  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({
        url: process.env.REDIS_URL,
      });

      await redisClient.connect();
      console.log("Connected to Redis");
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      console.log("Falling back to local file storage");
      redisClient = null;
      ensureLocalStorage();
    }
  } else {
    console.log("Using local file storage for wallet data");
    ensureLocalStorage();
  }
}

/**
 * Ensure local storage directory exists
 */
export function ensureLocalStorage() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Save wallet data to storage
 */
export async function saveWalletData(userId: string, walletData: string) {
  const redisKey = `${WALLET_KEY_PREFIX}${userId}`;
  const localFilePath = `${LOCAL_STORAGE_DIR}/${userId}.json`;

  if (redisClient && redisClient.isReady) {
    // Save to Redis
    await redisClient.set(redisKey, walletData);
  } else {
    // Save to local file
    try {
      fs.writeFileSync(localFilePath, walletData);
    } catch (error) {
      console.error(`Failed to save wallet data to file: ${error}`);
    }
  }
}

/**
 * Get wallet data from storage
 */
export async function getWalletData(userId: string): Promise<string | null> {
  const redisKey = `${WALLET_KEY_PREFIX}${userId}`;
  const localFilePath = `${LOCAL_STORAGE_DIR}/${userId}.json`;

  if (redisClient && redisClient.isReady) {
    return await redisClient.get(redisKey);
  } else {
    try {
      if (fs.existsSync(localFilePath)) {
        return fs.readFileSync(localFilePath, "utf8");
      }
    } catch (error) {
      console.warn(`Could not read wallet data from file: ${error}`);
    }
    return null;
  }
} 