import { getRandomValues } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import {
  Client,
  type ClientOptions,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createWalletClient, http, isAddress, toBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

export { DecodedMessage };

dotenv.config();

export async function xmtpClient({
  name,
  walletKey,
  encryptionKey,
  options,
  onMessage,
}: {
  name?: string;
  walletKey?: string;
  encryptionKey?: string;
  options?: ClientOptions;
  onMessage?: (message: DecodedMessage) => Promise<void>;
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

  if (onMessage) {
    void streamMessages(onMessage, client);
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

export async function send(message: string, address: string, client: Client) {
  const inboxId = !isAddress(address)
    ? address
    : await client.getInboxIdByAddress(address);

  if (!inboxId) {
    throw new Error("Invalid receiver address");
  }

  let conversation = client.conversations.getDmByInboxId(inboxId);
  if (!conversation) {
    conversation = await client.conversations.newDm(address);
  }
  return conversation.send(message);
}
async function streamMessages(
  onMessage: (message: DecodedMessage) => Promise<void>,
  client: Client | undefined,
) {
  try {
    await client?.conversations.sync();
    const stream = await client?.conversations.streamAllMessages();
    if (stream) {
      for await (const message of stream) {
        const conversation = client?.conversations.getConversationById(
          (message as DecodedMessage).conversationId,
        );
        if (message && conversation) {
          try {
            const { senderInboxId, kind } = message;

            if (
              // Filter out membership_change messages and sent by one
              senderInboxId.toLowerCase() === client?.inboxId.toLowerCase() &&
              kind !== "membership_change" //membership_change is not a message
            ) {
              continue;
            } else if (message.contentType?.typeId !== "text") {
              continue;
            }

            await conversation.sync();
            await onMessage(message);
          } catch (e) {
            console.log(`error`, e);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Stream encountered an error:`, err);
  }
}

/*VIEM*/
export interface UserReturnType {
  key: string;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

function createSigner(user: UserReturnType) {
  return {
    getAddress: () => user.account.address,
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        account: user.account,
        message,
      });
      return toBytes(signature);
    },
  };
}

export function createUser(key: string): UserReturnType {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key,
    account,
    wallet: createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    }),
  };
}
