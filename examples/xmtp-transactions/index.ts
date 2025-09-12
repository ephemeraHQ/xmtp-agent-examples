import { Agent, getTestUrl } from "@xmtp/agent-sdk";
import { TransactionReferenceCodec } from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
} from "@xmtp/content-type-wallet-send-calls";
import { USDCHandler } from "./usdc";

process.loadEnvFile(".env");

const NETWORK_ID = process.env.NETWORK_ID || "base-sepolia";

const usdcHandler = new USDCHandler(NETWORK_ID);

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new WalletSendCallsCodec(), new TransactionReferenceCodec()],
});

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;
  const command = messageContent.toLowerCase().trim();

  console.log(
    `Received message: ${messageContent} by ${ctx.message.senderInboxId}`,
  );
  console.log("Network:", NETWORK_ID);

  // Get the agent's address
  const agentAddress = agent.client.accountIdentifier?.identifier || "";

  // Get sender address from inbox ID
  const senderAddress = await ctx.getSenderAddress();

  try {
    if (command === "/balance") {
      const result = await usdcHandler.getUSDCBalance(agentAddress);
      await ctx.conversation.send(`Your USDC balance is: ${result} USDC`);
    } else if (command.startsWith("/tx ")) {
      const amount = parseFloat(command.split(" ")[1]);
      if (isNaN(amount) || amount <= 0) {
        await ctx.conversation.send(
          "Please provide a valid amount. Usage: /tx <amount>",
        );
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
    } else {
      await ctx.conversation.send(
        "Available commands:\n" +
          "/balance - Check your USDC balance\n" +
          "/tx <amount> - Send USDC to the agent (e.g. /tx 0.1)",
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing command:", errorMessage);
    await ctx.conversation.send(
      "Sorry, I encountered an error processing your command.",
    );
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

void agent.start();
