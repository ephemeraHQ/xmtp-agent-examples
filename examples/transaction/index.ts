import "dotenv/config";
import {
  createSigner,
  getAddressOfMember,
  getEncryptionKeyFromHex,
} from "@helpers";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
  type WalletSendCallsParams,
} from "./WalletSendCalls";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/* Set the environment to local, dev or production */
const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  /* Initialize the xmtp client */
  const client = await Client.create(signer, encryptionKey, {
    env,
    codecs: [new WalletSendCallsCodec()],
  });

  console.log("Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}?env=${env}`,
  );

  console.log("Waiting for messages...");
  /* Stream all messages from the network */
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    /* Get the conversation by id */
    const conversation = client.conversations.getDmByInboxId(
      message.senderInboxId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }
    const members = await conversation.members();

    const address = getAddressOfMember(members, message.senderInboxId);
    console.log(`Sending "gm" response to ${address}...`);
    /* Send a message to the conversation */

    const walletSendCalls: WalletSendCallsParams = {
      version: "1.0",
      from: address as `0x${string}`,
      chainId: "0x2105",
      calls: [
        {
          to: "0x789...cba",
          data: "0xdead...beef",
          metadata: {
            description: "Transfer .1 USDC on Base Sepolia",
            transactionType: "transfer",
            currency: "USDC",
            amount: 10000000,
            decimals: 6,
            platform: "base-sepolia",
          },
        },
      ],
    };

    await conversation.send(walletSendCalls, ContentTypeWalletSendCalls);

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
