import * as fs from "fs";
import { createClient, type RedisClientType } from "redis";

// Storage constants
export const WALLET_KEY_PREFIX = "wallet_data:";
export const LOCAL_STORAGE_DIR = "./wallet_data";
export let redisClient: RedisClientType | null = null;

if (!process.env.REDIS_URL) {
  console.warn(
    "Warning: REDIS_URL not set, using local file storage for wallet data",
  );
}
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
    } catch (error: unknown) {
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
export async function saveWalletData(
  userId: string,
  walletData: string,
  networkId: string,
): Promise<void> {
  const key = `${WALLET_KEY_PREFIX}${userId}-${networkId}`;
  if (redisClient && redisClient.isReady) {
    // Save to Redis
    await redisClient.set(key, walletData);
  } else {
    // Save to local file
    try {
      fs.writeFileSync(LOCAL_STORAGE_DIR + "/" + key, walletData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to save wallet data to file: ${errorMessage}`);
    }
  }
}

/**
 * Get wallet data from storage
 */
export async function getWalletData(
  key: string,
  networkId: string,
): Promise<string | null> {
  const userKey = `${WALLET_KEY_PREFIX}${key}-${networkId}`;

  if (redisClient && redisClient.isReady) {
    return await redisClient.get(userKey);
  } else {
    try {
      if (fs.existsSync(LOCAL_STORAGE_DIR + "/" + key)) {
        return fs.readFileSync(LOCAL_STORAGE_DIR + "/" + key, "utf8");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`Could not read wallet data from file: ${errorMessage}`);
    }
    return null;
  }
}
