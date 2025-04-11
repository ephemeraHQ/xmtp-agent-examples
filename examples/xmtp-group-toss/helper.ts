import { existsSync, mkdirSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { Coinbase, type Wallet, type WalletData } from "@coinbase/coinbase-sdk";
import { validateEnvironment } from "@helpers/utils";

export const WALLET_STORAGE_DIR = ".data/wallet_data";
export const XMTP_STORAGE_DIR = ".data/xmtp";
export const TOSS_STORAGE_DIR = ".data/tosses";

// Interface to track participant options
export interface Participant {
  inboxId: string;
  option: string;
}

// Interface for transfer response
export interface TransferResponse {
  model?: {
    sponsored_send?: {
      transaction_link?: string;
    };
  };
}

export interface GroupTossName {
  id: string;
  creator: string;
  tossAmount: string;
  status: TossStatus;
  participants: string[]; // Maintaining for backward compatibility
  participantOptions: Participant[]; // New field to track participant options
  winner?: string;
  walletAddress: string;
  createdAt: number;
  tossResult?: string;
  paymentSuccess?: boolean;
  transactionLink?: string;
  tossTopic?: string;
  tossOptions?: string[];
}

export enum TossStatus {
  CREATED = "CREATED",
  WAITING_FOR_PLAYER = "WAITING_FOR_PLAYER",
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

// Agent wallet data
export type AgentWalletData = {
  id: string;
  walletData: WalletData;
  agent_address: string;
  inboxId: string;
  wallet?: Wallet;
};

export interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

// Interface for parsed toss information
export interface ParsedToss {
  topic: string;
  options: string[];
  amount: string;
}

// Define stream chunk types
export interface AgentChunk {
  agent: {
    messages: Array<{
      content: string;
    }>;
  };
}

export interface ToolsChunk {
  tools: {
    messages: Array<{
      content: string;
    }>;
  };
}

export type StreamChunk = AgentChunk | ToolsChunk;

// Interface for parsed JSON response
export interface TossJsonResponse {
  topic?: string;
  options?: string[];
  amount?: string;
  valid?: boolean;
  reason?: string;
}

/**
 * Extract JSON from agent response text
 * @param response The text response from agent
 * @returns Parsed JSON object or null if not found
 */
export function extractJsonFromResponse(
  response: string,
): TossJsonResponse | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as TossJsonResponse;
    }
    return null;
  } catch (error) {
    console.error("Error parsing JSON from agent response:", error);
    return null;
  }
}
const { CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, NETWORK_ID } =
  validateEnvironment([
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "NETWORK_ID",
  ]);

// Initialize Coinbase SDK
export function initializeCoinbaseSDK(): boolean {
  try {
    Coinbase.configure({
      apiKeyName: CDP_API_KEY_NAME,
      privateKey: CDP_API_KEY_PRIVATE_KEY,
    });
    console.log("Coinbase SDK initialized successfully, network:", NETWORK_ID);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to initialize Coinbase SDK:", errorMessage);
    return false;
  }
}

/**
 * Storage service for coin toss  data and user wallets
 */
export class StorageService {
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
    identifier: string,
    data: string,
  ): Promise<boolean> {
    const toRead = `${identifier}-${NETWORK_ID}`;
    try {
      const filePath = path.join(directory, `${toRead}.json`);
      await fs.writeFile(filePath, data);
      return true;
    } catch (error) {
      console.error(`Error writing to file ${toRead}:`, error);
      return false;
    }
  }

  /**
   * Read data from a JSON file
   */
  private async readFromFile<T>(
    directory: string,
    identifier: string,
  ): Promise<T | null> {
    try {
      const key = `${identifier}-${NETWORK_ID}`;
      const filePath = path.join(directory, `${key}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      return JSON.parse(data) as T;
    } catch (error) {
      // If file doesn't exist, return null
      if (
        error instanceof Error &&
        (error.message.includes("ENOENT") ||
          error.message.includes("no such file or directory"))
      ) {
        return null;
      }
      // For other errors, rethrow
      throw error;
    }
  }

  /**
   * Save a coin toss game
   */
  public async saveToss(toss: GroupTossName): Promise<void> {
    if (!this.initialized) this.initialize();
    await this.saveToFile(TOSS_STORAGE_DIR, toss.id, JSON.stringify(toss));
  }

  /**
   * Get a coin toss game by ID
   */
  public async getToss(tossId: string): Promise<GroupTossName | null> {
    if (!this.initialized) this.initialize();
    return this.readFromFile<GroupTossName>(TOSS_STORAGE_DIR, tossId);
  }

  /**
   * List all active games
   */
  public async listActiveTosses(): Promise<GroupTossName[]> {
    if (!this.initialized) this.initialize();

    const tosses: GroupTossName[] = [];
    try {
      const files = await fs.readdir(TOSS_STORAGE_DIR);

      for (const file of files) {
        if (file.endsWith(".json")) {
          const tossId = file.replace(`-${NETWORK_ID}.json`, "");
          const toss = await this.getToss(tossId);
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
   * Update an existing game (alias for saveToss)
   */
  public async updateToss(toss: GroupTossName): Promise<void> {
    await this.saveToss(toss);
  }

  /**
   * Save user wallet data
   */
  public async saveWallet(inboxId: string, walletData: string): Promise<void> {
    if (!this.initialized) this.initialize();
    await this.saveToFile(WALLET_STORAGE_DIR, inboxId, walletData);
  }

  /**
   * Get user wallet data by user ID
   */
  public async getWallet(inboxId: string): Promise<AgentWalletData | null> {
    if (!this.initialized) this.initialize();
    return this.readFromFile<AgentWalletData>(WALLET_STORAGE_DIR, inboxId);
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

  /**
   * Get the toss storage directory
   */
  public getTossStorageDir(): string {
    return TOSS_STORAGE_DIR;
  }
}

// Create a single global instance
const storage = new StorageService();

// Export the storage instance
export { storage };
