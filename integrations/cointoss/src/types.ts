// Interface to track participant options
export interface Participant {
  userId: string;
  option: string;
}

export interface CoinTossGame {
  id: string;
  creator: string;
  betAmount: string;
  status: GameStatus;
  participants: string[];        // Maintaining for backward compatibility
  participantOptions: Participant[]; // New field to track participant options
  winner?: string;
  walletAddress: string;
  createdAt: number;
  coinTossResult?: string;
  paymentSuccess?: boolean;
  transactionLink?: string;
  betTopic?: string;
  betOptions?: string[];
}

export enum GameStatus {
  CREATED = "CREATED",
  WAITING_FOR_PLAYER = "WAITING_FOR_PLAYER",
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED"
}

export interface UserWallet {
  userId: string;
  walletData: string;
}

export interface StorageProvider {
  saveGame(game: CoinTossGame): Promise<void>;
  getGame(gameId: string): Promise<CoinTossGame | null>;
  listActiveGames(): Promise<CoinTossGame[]>;
  updateGame(game: CoinTossGame): Promise<void>;
  saveUserWallet(wallet: UserWallet): Promise<void>;
  getUserWallet(userId: string): Promise<string | null>;
}

export interface AgentConfig {
  configurable: {
    thread_id: string;
  };
} 