import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

/**
 * Initialize the XMTP client
 */
export async function initializeXmtpClient() {
  const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = process.env;

  if (!WALLET_KEY || !ENCRYPTION_KEY || !XMTP_ENV) {
    throw new Error(
      "Some environment variables are not set. Please check your .env file.",
    );
  }
  // Create the signer using viem
  const signer = createSigner(WALLET_KEY as `0x${string}`);
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  // Set the environment to dev or production
  const env: XmtpEnv = XMTP_ENV as XmtpEnv;

  console.log(`Creating XMTP client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, { env });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;

  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}?env=${env}`,
  );

  return client;
}

export type MessageHandler = (
  message: DecodedMessage,
  conversation: Conversation,
) => Promise<void>;

/**
 * Start listening for messages and handle them with the provided handler
 */
export async function startMessageListener(
  client: Client,
  messageHandler: MessageHandler,
): Promise<void> {
  console.log("🎮 CoinToss Agent is listening for messages...");
  console.log("👂 Mention @toss in a group chat or use direct messages");
  console.log(
    "🔍 Example: '@toss create 0.01' or '@toss Will Bitcoin reach $100k this year for 5 USDC?'",
  );

  // Stream all messages
  const stream = client.conversations.streamAllMessages();
  for await (const message of await stream) {
    // Ignore messages from the same agent or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }
    // Check if it has @toss
    const command = extractCommand(message.content as string);
    if (!command) continue; // No command found, skip

    // Get conversation
    const conversationId = message.conversationId;
    const conversation =
      await client.conversations.getConversationById(conversationId);
    if (!conversation) continue;

    console.log(
      `📩 Received command from ${message.senderInboxId}: ${command}`,
    );

    // Process the command
    await messageHandler(message, conversation);
  }
}

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
