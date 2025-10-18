import type { Conversation, DecodedMessage, XmtpEnv } from "@xmtp/agent-sdk";

export interface ChatConfig {
  env: XmtpEnv;
  agentIdentifiers?: string[];
}

export interface FormattedMessage {
  id: string;
  senderInboxId: string;
  content: string;
  timestamp: Date;
  isFromSelf: boolean;
}

export interface ConversationInfo {
  id: string;
  type: "dm" | "group";
  name?: string;
  peerInboxId?: string;
  memberCount?: number;
}

export { Conversation, DecodedMessage, XmtpEnv };
