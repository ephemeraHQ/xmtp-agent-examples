import "dotenv/config";
import {
  createSigner,
  getAddressOfMember,
  getEncryptionKeyFromHex,
} from "@helpers";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
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
    const conversation = client.conversations.getDmByInboxId(
      message.senderInboxId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }
    const members = await conversation.members();

    const memberAddress = getAddressOfMember(members, client.inboxId);

    if (!memberAddress) {
      console.log("Unable to find member address, skipping");
      continue;
    }

    // Transaction data parameters for USDC transfer
    const transferAmount = 100000; // 0.1 USDC (100000 = 0.1 * 10^6 due to 6 decimal places)
    const recipientAddress = agentAddress; // The address receiving the USDC
    const methodSignature = "0xa9059cbb"; // Function signature for ERC20 'transfer(address,uint256)'

    // Format the transaction data following ERC20 transfer standard:
    // methodSignature + paddedRecipientAddress + paddedAmount
    const transactionData = `${methodSignature}${recipientAddress
      .slice(2)
      .padStart(
        64,
        "0",
      )}${BigInt(transferAmount).toString(16).padStart(64, "0")}`;

    // Configuration for Base Sepolia USDC transfers
    const usdcConfig = {
      tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC contract
      chainId: "0x14A34", // Base Sepolia network ID (84532 in hex)
      decimals: 6, // USDC uses 6 decimal places
      platform: "base", // The network platform
    };

    // Create the wallet send calls parameters
    const walletSendCalls: WalletSendCallsParams = {
      version: "1.0", // Protocol version
      from: memberAddress as `0x${string}`, // The sender's address
      chainId: usdcConfig.chainId as `0x${string}`,
      calls: [
        {
          to: usdcConfig.tokenAddress as `0x${string}`, // Contract address to interact with
          data: transactionData as `0x${string}`, // Encoded transaction data
          metadata: {
            description: "Transfer 0.1 USDC on Base Sepolia", // Human-readable description
            transactionType: "transfer", // Type of transaction
            currency: "USDC", // Token being transferred
            amount: transferAmount, // Amount in base units
            decimals: usdcConfig.decimals, // Token decimal places
            platform: usdcConfig.platform, // Network platform
          },
        },
        // Second identical transfer
        {
          to: usdcConfig.tokenAddress as `0x${string}`,
          data: transactionData as `0x${string}`,
          metadata: {
            description: "Transfer 0.1 USDC on Base Sepolia",
            transactionType: "transfer",
            currency: "USDC",
            amount: transferAmount,
            decimals: usdcConfig.decimals,
            platform: usdcConfig.platform,
          },
        },
      ],
    };

    await conversation.send(walletSendCalls, ContentTypeWalletSendCalls);

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
