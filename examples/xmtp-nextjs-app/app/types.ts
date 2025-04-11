import { Client as BrowserClient } from "@xmtp/browser-sdk";
import { Client as NodeClient } from "@xmtp/node-sdk";

type XMTPClient = NodeClient | BrowserClient;

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  description: string;
  client: XMTPClient;
  address: string;
}

/**
 * Message handler function type
 */
export type MessageHandler = (
  _message: string,
  _senderAddress: string,
  _client: XMTPClient,
) => Promise<void>;

/**
 * Agent response type
 */
export interface AgentResponse {
  success: boolean;
  message: string;
  error?: string;
}
