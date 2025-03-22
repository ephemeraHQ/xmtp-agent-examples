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

  // Replace \\n with actual newlines if present in the private key
  if (process.env.CDP_API_KEY_PRIVATE_KEY) {
    process.env.CDP_API_KEY_PRIVATE_KEY =
      process.env.CDP_API_KEY_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  return [
    process.env.CDP_API_KEY_NAME,
    process.env.CDP_API_KEY_PRIVATE_KEY,
    process.env.NETWORK_ID,
  ];
}
export const ERROR_MESSAGE = `Sorry, I couldn't process your natural language toss. Please try again with a different wording or use explicit commands.

Example: "Will the price of Bitcoin reach $100k this year for 5"
Or use: create <amount> - to create a standard toss`;

export const HELP_MESSAGE = `Available commands:
create <amount> - Create a new toss with specified USDC amount
join <tossId> <option> - Join an existing toss with the specified ID and your chosen option
close <tossId> <option> - Close the toss and set the winning option (only for toss creator)
status <tossId> - Check the status of a specific toss
list - List all active tosses
balance - Check your wallet balance and address
help - Show this help message

You can also create a toss using natural language, for example:
"Will it rain tomorrow for 5" - Creates a yes/no toss with 5 USDC
"Lakers vs Celtics for 10" - Creates a toss with Lakers and Celtics as options with 10 USDC`;
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
}
