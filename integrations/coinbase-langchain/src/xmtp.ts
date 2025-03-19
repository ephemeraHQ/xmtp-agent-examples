import { IdentifierKind } from "@xmtp/node-bindings";
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

  const conversation = await client.conversations.newDmWithIdentifier({
    identifierKind: IdentifierKind.Ethereum,
    identifier: "0xb222ec34482e3503988cfe81ced46ef10099c3e6",
  });
  //convos 0x0952bf0013b819a5fbbace9b60709044a53ea2e3
  //0xb222ec34482e3503988cfe81ced46ef10099c3e6
  console.log(conversation.id);
  await conversation.send("Hello, world!");

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
    await handleMessage(message, conversation);
  }
}
