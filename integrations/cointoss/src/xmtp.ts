import { Client, type Signer, type XmtpEnv } from "@xmtp/node-sdk";
import { IdentifierKind } from "@xmtp/node-bindings";
import { fromString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

/**
 * Create a viem signer from a wallet private key
 * @param walletKey - Wallet private key as a hex string
 * @returns A signer object compatible with XMTP
 */
export const createSigner = (walletKey: string): Signer => {
  const account = privateKeyToAccount(walletKey as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  return {
    type: "EOA" as const,
    getIdentifier: () => ({
      identifierKind: IdentifierKind.Ethereum,
      identifier: account.address.toLowerCase(),
    }),
    signMessage: async (message: string) => {
      const signature = await wallet.signMessage({
        message,
        account,
      });
      return toBytes(signature);
    },
  };
}

/**
 * Convert hex encryption key to appropriate format for XMTP
 * @param key - Encryption key as a hex string
 * @returns Encryption key bytes
 */
function getEncryptionKeyFromHex(key: string): Uint8Array {
  // Remove 0x prefix if present
  const hexString = key.startsWith("0x") ? key.slice(2) : key;
  return fromString(hexString, "hex");
}

/**
 * Initialize the XMTP client
 */
export async function initializeXmtpClient() {
  const { WALLET_KEY, ENCRYPTION_KEY } = process.env;

  if (!WALLET_KEY || !ENCRYPTION_KEY) {
    throw new Error("WALLET_KEY and ENCRYPTION_KEY must be set in environment variables");
  }

  // Create the signer using viem
  const signer = createSigner(WALLET_KEY);
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Set the environment to dev or production
  const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv || "dev";

  console.log(`Creating XMTP client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, { env });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();

  console.log(
    `CoinToss Agent initialized on ${identifier.identifier}\nSend a message on http://xmtp.chat/dm/${identifier.identifier}?env=${env}`
  );

  return { client, env };
}

export type MessageHandler = (message: any, conversation: any, userId: string, content: string) => Promise<void>;

/**
 * Extract command from message content
 * @param content Message content
 * @returns Command extracted from the message content or null if no command is found
 */
export function extractCommand(content: string): string | null {
  // Check for @toss mentions 
  const botMentionRegex = /@toss\s+(.*)/i;
  const botMentionMatch = content.match(botMentionRegex);
  
  if (botMentionMatch) {
    // We found an @toss mention, extract everything after it
    return botMentionMatch[1].trim();
  }
  
  return null;
}

/**
 * Start listening for messages and handle them with the provided handler
 */
export async function startMessageListener(client: any, 
  messageHandler: (message: any, conversation: any, userId: string, content: string) => Promise<void>
): Promise<void> {
  console.log("🎮 CoinToss Agent is listening for messages...");
  console.log("👂 Mention @toss in a group chat or use direct messages");
  console.log("🔍 Example: '@toss create 0.01' or '@toss Will Bitcoin reach $100k this year for 5 USDC?'");
  
  // Stream all messages
  for await (const message of await client.conversations.streamAllMessages()) {
    try {
      // Skip if message is undefined
      if (!message) continue;
      
      // Get conversation
      const conversationId = message.conversationId;
      const conversation = await client.conversations.getConversationById(conversationId);
      if (!conversation) continue;
      
      // Get message content
      const content = message.content;
      if (!content) continue;
      
      // Extract sender (userId)
      const sender = message.senderAddress || message.senderInboxId;
      if (sender === client.address || sender === client.inboxId) continue; // Skip our own messages
      
      // Extract command from the message content
      const command = extractCommand(content);
      if (!command) continue; // No command found, skip
      
      console.log(`📩 Received command from ${sender}: ${command}`);
      
      // Process the command
      await messageHandler(message, conversation, sender, command);
    } catch (error) {
      console.error("Error in message listener:", error);
    }
  }
} 