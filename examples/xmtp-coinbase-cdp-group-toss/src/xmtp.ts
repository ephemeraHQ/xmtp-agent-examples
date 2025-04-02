import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import {
  Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { XMTP_STORAGE_DIR } from "./storage";

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
  const signer = createSigner(WALLET_KEY as `0x${string}`); // TODO: Fix this
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;

  // Set the environment to dev or production
  const env: XmtpEnv = XMTP_ENV as XmtpEnv;

  console.log(`Creating XMTP client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env,
    dbPath: XMTP_STORAGE_DIR + `/${env}-${address}`,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}?env=${env}`,
  );

  return client;
}

export type MessageHandler = (
  message: DecodedMessage,
  conversation: Conversation,
  command: string,
) => Promise<void>;

/**
 * Start listening for messages and handle them with the provided handler
 */
export async function startMessageListener(
  client: Client,
  handleMessage: MessageHandler,
) {
  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    // Ignore messages from the same agent or non-text messages
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }
    // Extract command from the message content
    const command = extractCommand(message.content as string);
    if (!command) {
      console.log(
        `Received message: ${message.content as string} by ${message.senderInboxId}`,
      );
      continue; // No command found, skip
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    // Get the conversation
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    // Handle the message
    await handleMessage(message, conversation, command);
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
