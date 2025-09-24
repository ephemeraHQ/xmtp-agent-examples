import { Agent, type AgentMiddleware } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import {
  TransactionReferenceCodec,
  ContentTypeTransactionReference,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
} from "@xmtp/content-type-wallet-send-calls";
import { USDCHandler } from "../../utils/usdc";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const NETWORK_ID = process.env.NETWORK_ID || "base-sepolia";

const usdcHandler = new USDCHandler(NETWORK_ID);

// Transaction reference middleware
const transactionReferenceMiddleware: AgentMiddleware = async (ctx, next) => {
  // Check if this is a transaction reference message
  if (ctx.message.contentType?.sameAs(ContentTypeTransactionReference)) {
    const transactionRef = ctx.message.content as TransactionReference;
    console.log("Received transaction reference:", transactionRef);

    await ctx.sendText(
      `✅ Transaction confirmed!\n` +
        `🔗 Network: ${transactionRef.networkId}\n` +
        `📄 Hash: ${transactionRef.reference}\n` +
        `${transactionRef.metadata ? `📝 Transaction metadata received` : ""}`,
    );

    // Don't continue to other handlers since we handled this message
    return;
  }

  // Continue to next middleware/handler
  await next();
};

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new WalletSendCallsCodec(), new TransactionReferenceCodec()],
});

// Apply the transaction reference middleware
agent.use(transactionReferenceMiddleware);

agent.on("text", async (ctx) => {
  if (!ctx.message.content.startsWith("/balance")) return;
  const agentAddress = agent.address || "";

  const result = await usdcHandler.getUSDCBalance(agentAddress);
  await ctx.sendText(`Your USDC balance is: ${result} USDC`);
});

agent.on("text", async (ctx) => {
  if (!ctx.message.content.startsWith("/tx")) return;
  const agentAddress = agent.address || "";
  const senderAddress = await ctx.getSenderAddress();

  const amount = parseFloat((ctx.message.content as string).split(" ")[1]);
  if (isNaN(amount) || amount <= 0) {
    await ctx.sendText("Please provide a valid amount. Usage: /tx <amount>");
    return;
  }

  // Convert amount to USDC decimals (6 decimal places)
  const amountInDecimals = Math.floor(amount * Math.pow(10, 6));

  const walletSendCalls = usdcHandler.createUSDCTransferCalls(
    senderAddress,
    agentAddress,
    amountInDecimals,
  );
  console.log("Replied with wallet sendcall");
  await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);

  // Send a follow-up message about transaction references
  await ctx.sendText(
    `💡 After completing the transaction, you can send a transaction reference message to confirm completion.`,
  );
});

agent.on("text", async (ctx) => {
  if (ctx.isDm() && !ctx.message.content.startsWith("/")) return;

  await ctx.sendText(
    "Available commands:\n" +
      "/balance - Check your USDC balance\n" +
      "/tx <amount> - Send USDC to the agent (e.g. /tx 0.1)",
  );
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();
