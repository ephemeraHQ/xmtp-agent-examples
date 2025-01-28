import { getRandomValues } from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";
import { ContentTypeText, TextCodec } from "@xmtp/content-type-text";
import {
  Client,
  type ClientOptions,
  type Conversation,
  type DecodedMessage,
} from "@xmtp/node-sdk";
import dotenv from "dotenv";
import { createWalletClient, http, isAddress, toBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

dotenv.config();

export type clientMessage = {
  message: string;
  originalMessage?: Message;
  receivers?: string[];
  typeId?:
    | "text"
    | "image"
    | "reaction"
    | "reply"
    | "attachment"
    | "read_receipt"
    | "agent_message";
};

export interface UserReturnType {
  key: string;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

export type xmtpClientType = {
  name?: string;
  walletKey?: string;
  encryptionKey?: string;
  onMessage?: (message: Message) => Promise<void>;
  config?: ClientOptions;
};

export type Message = {
  id: string; // Unique identifier for the message
  sent: Date; // Date when the message was sent
  content: {
    text?: string | undefined; // Text content of the message
    reply?: string | undefined; // Reply content if the message is a reply
    previousMsg?: string | undefined; // Reference to the previous message
    attachment?: string | undefined; // Attachment content if the message is an attachment
    reference?: string | undefined; // Reference ID for the message
  };
  group?: {
    id: string;
    createdAt: Date;
    topic?: string;
    members?: {
      address: string;
      inboxId: string;
      installationIds: string[];
      accountAddresses: string[];
      username?: string;
      ensDomain?: string;
    }[];
    admins?: string[];
    name?: string;
    superAdmins?: string[];
  };
  sender: {
    address: string;
    inboxId: string;
    installationIds: string[];
    accountAddresses: string[];
    username?: string;
    ensDomain?: string;
  }; // Sender of the message
  typeId: string; // Type identifier for the message
  client: {
    address: string;
    inboxId: string;
  };
};

export async function xmtpClient(agent?: xmtpClientType): Promise<XMTP> {
  let xmtp: XMTP | null = null; // Ensure a single instance
  xmtp = new XMTP(agent);
  await xmtp.init();
  return xmtp;
}

export class XMTP {
  client: Client | undefined;
  address: string | undefined;
  inboxId: string | undefined;
  onMessage: (message: Message) => Promise<void>;
  agent?: xmtpClientType;

  constructor(agent?: xmtpClientType) {
    this.onMessage = agent?.onMessage ?? (() => Promise.resolve());
    this.agent = agent;
  }

  async init(): Promise<XMTP> {
    const suffix = this.agent?.name ? "_" + this.agent.name : "";
    let encryptionKey =
      this.agent?.encryptionKey ??
      process.env["ENCRYPTION_KEY" + suffix] ??
      toHex(getRandomValues(new Uint8Array(32)));

    if (!encryptionKey.startsWith("0x")) {
      encryptionKey = "0x" + encryptionKey;
    }
    let walletKey =
      this.agent?.walletKey ??
      process.env["WALLET_KEY" + suffix] ??
      toHex(getRandomValues(new Uint8Array(32)));

    if (!walletKey.startsWith("0x")) {
      walletKey = "0x" + walletKey;
    }

    const user = createUser(walletKey);

    let env = this.agent?.config?.env;
    if (!env) env = "production";

    const dbPath =
      process.env.RAILWAY_VOLUME_MOUNT_PATH ??
      this.agent?.config?.dbPath ??
      ".data/xmtp";

    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const defaultConfig: ClientOptions = {
      env: env,
      dbPath: `${dbPath}/${user.account.address.toLowerCase()}-${env}`,
      codecs: [new TextCodec()],
    };

    // Merge the default configuration with the provided config. Repeated fields in clientConfig will override the default values
    const finalConfig = { ...defaultConfig, ...this.agent?.config };

    const client = await Client.create(
      createSigner(user),
      new Uint8Array(toBytes(encryptionKey as `0x${string}`)),
      finalConfig,
    );

    this.client = client;
    this.inboxId = client.inboxId;
    this.address = client.accountAddress;
    void streamMessages(this.onMessage, client, this);
    this.saveKeys(suffix, walletKey, encryptionKey);
    return this;
  }
  saveKeys(suffix: string, walletKey: string, encryptionKey: string) {
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

  async send(clientMessage: clientMessage) {
    const contentType = ContentTypeText;

    const message = clientMessage.message;

    if (!clientMessage.receivers || clientMessage.receivers.length == 0) {
      clientMessage.receivers = [
        clientMessage.originalMessage?.sender.inboxId as string,
      ];
    }

    for (const receiverAddress of clientMessage.receivers) {
      const inboxId = !isAddress(receiverAddress)
        ? receiverAddress
        : await this.client?.getInboxIdByAddress(receiverAddress);

      if (!inboxId) {
        throw new Error("Invalid receiver address");
      }

      let conversation = this.client?.conversations.getDmByInboxId(inboxId);
      if (!conversation) {
        conversation = await this.client?.conversations.newDm(receiverAddress);
      }
      return conversation?.send(message, contentType);
    }
  }

  getConversationFromMessage(message: DecodedMessage | null | undefined) {
    return this.client?.conversations.getConversationById(
      (message as DecodedMessage).conversationId,
    );
  }

  async canMessage(address: string): Promise<boolean> {
    const isOnXMTP = await this.client?.canMessage([address]);
    return isOnXMTP ? true : false;
  }
}

async function streamMessages(
  onMessage: (message: Message) => Promise<void>,
  client: Client | undefined,
  xmtp: XMTP,
) {
  try {
    await client?.conversations.sync();
    const stream = await client?.conversations.streamAllMessages();
    if (stream) {
      for await (const message of stream) {
        const conversation = xmtp.getConversationFromMessage(message);
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
            const parsedMessage = await parseMessage(
              message,
              conversation,
              client as Client,
            );
            await onMessage(parsedMessage as Message);
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

export async function parseMessage(
  message: DecodedMessage,
  conversation: Conversation | undefined,
  client: Client,
): Promise<Message | undefined> {
  const content = {
    text: message.content as string,
  };

  let sender:
    | {
        inboxId: string;
        address: string;
        accountAddresses: string[];
        installationIds: string[];
      }
    | undefined = undefined;

  await conversation?.sync();
  const members = await conversation?.members();
  const membersArray = members?.map((member) => ({
    inboxId: member.inboxId,
    address: member.accountAddresses[0],
    accountAddresses: member.accountAddresses,
    installationIds: member.installationIds,
  }));

  sender = membersArray?.find(
    (member) => member.inboxId === message.senderInboxId,
  );

  return {
    id: message.id,
    sender,
    group: {
      id: conversation?.id,
      createdAt: conversation?.createdAt,
      name: conversation?.name,
      members: membersArray,
      admins: conversation?.admins,
      superAdmins: conversation?.superAdmins,
    },
    sent: message.sentAt,
    content,
    typeId: "text",
    client: {
      address: client.accountAddress,
      inboxId: client.inboxId,
    },
  } as Message;
}
