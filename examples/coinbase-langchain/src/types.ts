import type { MemorySaver } from "@langchain/langgraph";
import type { createReactAgent } from "@langchain/langgraph/prebuilt";

export const memoryStore: Record<string, MemorySaver> = {};
export const agentStore: Record<string, Agent> = {};

export type XMTPUser = {
  inboxId: string;
  address: string;
};
export interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

export type Agent = ReturnType<typeof createReactAgent>;

// Define transfer result structure
export interface TransferData {
  model?: {
    sponsored_send?: {
      transaction_link?: string;
    };
  };
  transactionLink?: string;
}

// Define chunk structure for agent stream
export interface AgentChunk {
  agent?: {
    messages?: Array<{
      content?: string;
    }>;
  };
}
