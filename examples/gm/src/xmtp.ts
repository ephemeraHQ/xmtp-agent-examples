import * as fs from "node:fs";
import {
  Client,
  type ClientOptions,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { toBytes } from "viem";
import KeyManager from "./keys.js";
import { createSigner, createUser } from "./viem.js";

dotenv.config();

export async function createClient({
  suffix,
  walletKey,
  encryptionKey,
  options,
  streamMessageCallback,
}: {
  suffix?: string;
  walletKey?: string;
  encryptionKey?: string;
  options?: ClientOptions;
  streamMessageCallback?: (message: DecodedMessage) => Promise<void>;
}): Promise<Client> {
  const keyManager = new KeyManager(suffix);

  const {
    walletKey: clientWalletKey,
    encryptionKey: clientEncryptionKey,
    encryptionKeyBytes: clientEncryptionKeyBytes,
  } = keyManager.generateKeys(walletKey, encryptionKey);

  const user = createUser(clientWalletKey);

  const env = options?.env ?? "production";

  const dbPath = options?.dbPath ?? ".data/xmtp";

  //Creates a DB folder if it doesnt exist
  if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

  const clientConfig = {
    env,
    dbPath: `${dbPath}/${user.account.address.toLowerCase()}-${env}`,
    ...options,
  };

  const client = await Client.create(
    createSigner(user),
    clientEncryptionKeyBytes,
    clientConfig,
  );

  if (streamMessageCallback) {
    void streamMessages(streamMessageCallback, client);
  }
  keyManager.saveKeys(clientWalletKey, clientEncryptionKey);
  return client;
}

async function streamMessages(
  streamMessageCallback: (message: DecodedMessage) => Promise<void>,
  client: Client,
) {
  try {
    await client.conversations.sync();
    const stream = await client.conversations.streamAllMessages();
    for await (const decodedMessage of stream) {
      if (!decodedMessage) continue;
      const conversation = client.conversations.getConversationById(
        decodedMessage.conversationId,
      );
      if (!conversation) continue;
      try {
        if (
          // Filter out membership_change messages and sent by one
          decodedMessage.senderInboxId.toLowerCase() ===
            client.inboxId.toLowerCase() &&
          decodedMessage.kind !== "membership_change" //membership_change is not a message
        ) {
          continue;
        } else if (decodedMessage.contentType?.typeId !== "text") {
          continue;
        }
        await streamMessageCallback(decodedMessage);
      } catch (e) {
        console.log(`error`, e);
      }
    }
  } catch (e) {
    console.log(`error`, e);
  }
}

export async function getAddressFromInboxId(
  conversation: Conversation,
  senderInboxId: string,
): Promise<string> {
  await conversation.sync();
  const members = await conversation.members();
  const mainSenderAddress = members.find(
    (member) => member.inboxId === senderInboxId,
  )?.accountAddresses[0];

  if (!mainSenderAddress) {
    throw new Error("Invalid receiver address");
  }
  return mainSenderAddress;
}
