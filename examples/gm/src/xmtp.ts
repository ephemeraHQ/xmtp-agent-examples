import { getRandomValues } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import {
  Client,
  type ClientOptions,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { toBytes, toHex } from "viem";
import { createSigner, createUser } from "./viem.js";

dotenv.config();

export async function createClient({
  name,
  walletKey,
  encryptionKey,
  options,
  streamMessageCallback,
}: {
  name?: string;
  walletKey?: string;
  encryptionKey?: string;
  options?: ClientOptions;
  streamMessageCallback?: (message: DecodedMessage) => Promise<void>;
}): Promise<Client> {
  const suffix = name ? "_" + name : "";
  encryptionKey =
    encryptionKey ??
    process.env["ENCRYPTION_KEY" + suffix] ??
    toHex(getRandomValues(new Uint8Array(32)));

  if (!encryptionKey.startsWith("0x")) {
    encryptionKey = "0x" + encryptionKey;
  }
  walletKey =
    walletKey ??
    process.env["WALLET_KEY" + suffix] ??
    toHex(getRandomValues(new Uint8Array(32)));

  if (!walletKey.startsWith("0x")) {
    walletKey = "0x" + walletKey;
  }

  const user = createUser(walletKey);

  let env = options?.env;
  if (!env) env = "production";

  const dbPath =
    process.env.RAILWAY_VOLUME_MOUNT_PATH ?? options?.dbPath ?? ".data/xmtp";

  //Creates a DB folder if it doesnt exist
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  const clientConfig = {
    env: env,
    dbPath: `${dbPath}/${user.account.address.toLowerCase()}-${env}`,
    ...options,
  };

  const client = await Client.create(
    createSigner(user),
    new Uint8Array(toBytes(encryptionKey as `0x${string}`)),
    clientConfig,
  );

  if (streamMessageCallback) {
    void streamMessages(streamMessageCallback, client);
  }
  saveKeys(suffix, walletKey, encryptionKey);
  return client;
}

export function saveKeys(
  suffix: string,
  walletKey: string,
  encryptionKey: string,
) {
  const envFilePath = path.resolve(process.cwd(), ".env");
  const envContent = `\nENCRYPTION_KEY${suffix}=${encryptionKey}\nWALLET_KEY${suffix}=${walletKey}`;

  // Read the existing .env file content
  let existingEnvContent = "";
  if (fs.existsSync(envFilePath)) {
    existingEnvContent = fs.readFileSync(envFilePath, "utf8");
  }

  // Check if the keys already exist
  if (
    !existingEnvContent.includes(`ENCRYPTION_KEY${suffix}=`) &&
    !existingEnvContent.includes(`WALLET_KEY${suffix}=`)
  ) {
    fs.appendFileSync(envFilePath, envContent);
  }
}

/*Developers want to send their own callbacks for messages.
We could use this to send their own messages to the client.
*/
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
