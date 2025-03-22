import * as fs from "fs";
import { createClient, type RedisClientType } from "redis";

// Storage constantsf
export const WALLET_KEY_PREFIX = "wallet_data:";
export const WALLET_STORAGE_DIR = ".data/wallet_data";
export const XMTP_STORAGE_DIR = ".data/xmtp";
export let redisClient: RedisClientType | null = null;

/**
 * Initialize Redis client and handle fallback to local storage
 */
export async function initializeStorage() {
  if (process.env.REDIS_URL) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

    await redisClient.connect();
    console.log("Connected to Redis");
  } else {
    console.log("Using local file storage for wallet data");
    ensureLocalStorage();
  }
}

/**
 * Ensure local storage directory exists
 */
export function ensureLocalStorage() {
  if (!fs.existsSync(WALLET_STORAGE_DIR)) {
    fs.mkdirSync(WALLET_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Save wallet data to storage
 */
export async function saveWalletData(
  inboxId: string,
  walletData: string,
  networkId: string,
): Promise<void> {
  const key = `${WALLET_KEY_PREFIX}${inboxId}-${networkId}`;
  if (redisClient && redisClient.isReady) {
    // Save to Redis
    await redisClient.set(key, walletData);
  } else {
    // Save to local file
    try {
      fs.writeFileSync(WALLET_STORAGE_DIR + "/" + key + ".json", walletData);
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
  inboxId: string,
  networkId: string,
): Promise<string | null> {
  const userKey = `${WALLET_KEY_PREFIX}${inboxId}-${networkId}`;

  if (redisClient && redisClient.isReady) {
    return await redisClient.get(userKey);
  } else {
    try {
      if (fs.existsSync(WALLET_STORAGE_DIR + "/" + userKey)) {
        return fs.readFileSync(WALLET_STORAGE_DIR + "/" + userKey, "utf8");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`Could not read wallet data from file: ${errorMessage}`);
    }
    return null;
  }
}
