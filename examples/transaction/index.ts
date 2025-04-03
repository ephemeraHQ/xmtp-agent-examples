import "dotenv/config";
import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import {
  ContentTypeWalletSendCalls,
  createUSDCTransferCalls,
  getUSDCBalance,
  WalletSendCallsCodec,
} from "./helper";

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
  console.log("Starting transaction agent...");
  console.log(`Creating client on the '${env}' network...`);
  /* Initialize the xmtp client */
  const client = await Client.create(signer, encryptionKey, {
    env,
    codecs: [new WalletSendCallsCodec(), new TransactionReferenceCodec()],
  });

  console.log("Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const agentAddress = identifier.identifier;
  console.log(
    `Agent initialized on ${agentAddress}\nSend a message on http://xmtp.chat/dm/${agentAddress}?env=${env}`,
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
    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    const memberAddress = inboxState[0].identifiers[0].identifier;
    if (!memberAddress) {
      console.log("Unable to find member address, skipping");
      continue;
    }

    const messageContent = message.content as string;
    const command = messageContent.toLowerCase().trim();

    try {
      if (command === "/balance") {
        const balance = await getUSDCBalance(agentAddress);
        await conversation.send(`Your USDC balance is: ${balance} USDC`);
      } else if (command.startsWith("/tx ")) {
        const amount = parseFloat(command.split(" ")[1]);
        if (isNaN(amount) || amount <= 0) {
          await conversation.send(
            "Please provide a valid amount. Usage: /tx <amount>",
          );
          continue;
        }

        // Convert amount to USDC decimals (6 decimal places)
        const amountInDecimals = Math.floor(amount * Math.pow(10, 6));

        const walletSendCalls = createUSDCTransferCalls(
          memberAddress,
          agentAddress,
          amountInDecimals,
        );

        await conversation.send(walletSendCalls, ContentTypeWalletSendCalls);
      } else {
        await conversation.send(
          "Available commands:\n" +
            "/balance - Check your USDC balance\n" +
            "/tx <amount> - Send USDC to the agent (e.g. /tx 0.1)",
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing command:", errorMessage);
      await conversation.send(
        "Sorry, I encountered an error processing your command.",
      );
    }
  }
}

main().catch(console.error);
