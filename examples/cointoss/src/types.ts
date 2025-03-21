import type { Wallet, WalletData } from "@coinbase/coinbase-sdk";

// Interface for parsed toss information
export interface ParsedToss {
  topic: string;
  options: string[];
  amount: string;
}

export type XMTPUser = {
  inboxId: string;
  address: string;
};

// Interface to track participant options
export interface Participant {
  userId: string;
  option: string;
}

export interface CoinTossGame {
  id: string;
  creator: string;
  tossAmount: string;
  status: GameStatus;
  participants: string[]; // Maintaining for backward compatibility
  participantOptions: Participant[]; // New field to track participant options
  winner?: string;
  walletAddress: string;
  createdAt: number;
  coinTossResult?: string;
  paymentSuccess?: boolean;
  transactionLink?: string;
  tossTopic?: string;
  tossOptions?: string[];
}

export enum GameStatus {
  CREATED = "CREATED",
  WAITING_FOR_PLAYER = "WAITING_FOR_PLAYER",
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface UserWallet {
  humanAddress: string;
  walletData: string;
}

// Agent wallet data
export type AgentWalletData = {
  id: string;
  wallet: Wallet;
  data: WalletData;
  human_address: string;
  agent_address: string;
  blockchain?: string;
  state?: string;
  inboxId: string;
};

// Define transfer result structure
export interface TransferData {
  model?: {
    sponsored_send?: {
      transaction_link?: string;
    };
  };
  transactionLink?: string;
}

export interface StorageProvider {
  saveGame(game: CoinTossGame): Promise<void>;
  getGame(gameId: string): Promise<CoinTossGame | null>;
  listActiveGames(): Promise<CoinTossGame[]>;
  updateGame(game: CoinTossGame): Promise<void>;
  saveUserWallet(wallet: UserWallet): Promise<void>;
  getUserWallet(humanAddress: string): Promise<string | null>;
}

export interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}
