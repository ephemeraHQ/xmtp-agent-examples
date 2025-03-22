import type { Wallet, WalletData } from "@coinbase/coinbase-sdk";

export function validateEnvironment() {
  const requiredVars = [
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "WALLET_KEY",
    "XMTP_ENV",
    "OPENAI_API_KEY",
    "ENCRYPTION_KEY",
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length) {
    console.error("Missing env vars:", missing.join(", "));
    process.exit(1);
  }
}

// Interface to track participant options
export interface Participant {
  userId: string;
  option: string;
}

export interface CoinTossGame {
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

export interface UserWallet {
  userId: string;
  walletData: WalletData;
}
export interface XMTPUser {
  inboxId: string;
  address: string;
}
// Agent wallet data
export type AgentWalletData = {
  id: string;
  walletData: WalletData;
  human_address: string;
  agent_address: string;
  inboxId: string;
  wallet?: Wallet;
};

export interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}
