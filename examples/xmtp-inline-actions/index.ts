import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import {
  WalletSendCallsCodec,
  ContentTypeWalletSendCalls,
} from "@xmtp/content-type-wallet-send-calls";
import { USDCHandler } from "../../utils/usdc";
import {
  inlineActionsMiddleware,
  registerAction,
  ActionBuilder,
  sendActions,
} from "../../utils/inline-actions/inline-actions";
import { ActionsCodec } from "../../utils/inline-actions/types/ActionsContent";
import { IntentCodec } from "../../utils/inline-actions/types/IntentContent";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

const NETWORK_ID = process.env.NETWORK_ID || "base-sepolia";

async function main() {
  // Initialize USDC handler
  const usdcHandler = new USDCHandler(NETWORK_ID);
  const networkConfig = usdcHandler.getNetworkConfig();

  console.log(`📡 Connected to: ${networkConfig.networkName}`);
  console.log(`💰 USDC Address: ${networkConfig.tokenAddress}`);

  // Create agent using environment variables
  const agent = await Agent.createFromEnv({
    codecs: [new WalletSendCallsCodec(), new ActionsCodec(), new IntentCodec()],
  });

  const agentAddress = agent.address;
  if (!agentAddress) {
    throw new Error("Unable to get agent address");
  }

  // Helper function to create simple USDC transfer
  function createUSDCTransfer(
    fromAddress: string,
    amount: number,
    withMetadata: boolean = false,
  ) {
    const amountInDecimals = Math.floor(
      amount * Math.pow(10, networkConfig.decimals),
    );
    const calls = usdcHandler.createUSDCTransferCalls(
      fromAddress,
      agentAddress!,
      amountInDecimals,
    );

    // Add rich metadata if requested
    if (withMetadata) {
      calls.calls[0].metadata = {
        description: `Transfer ${amount} USDC`,
        transactionType: "transfer",
        currency: "USDC",
        amount: amountInDecimals,
        decimals: networkConfig.decimals,
        networkId: networkConfig.networkId,
        hostname: "tba.chat",
        faviconUrl:
          "https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet",
        title: "TBA Chat Agent",
      };
    }

    return calls;
  }

  // Register action handlers focused on inline actions UX
  registerAction("send-small", async (ctx) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) return;

    const transfer = createUSDCTransfer(senderAddress, 0.005);
    await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
    await ctx.sendText(
      "💸 Please approve the 0.005 USDC transfer in your wallet!",
    );
  });

  registerAction("send-large", async (ctx) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) return;

    const transfer = createUSDCTransfer(senderAddress, 1);
    await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
    await ctx.sendText("💸 Please approve the 1 USDC transfer in your wallet!");
  });

  registerAction("check-balance", async (ctx) => {
    const balance = await usdcHandler.getUSDCBalance(agentAddress!);
    await ctx.sendText(
      `💰 Bot Balance: ${balance} USDC on ${networkConfig.networkName}`,
    );
  });

  registerAction("send-with-metadata", async (ctx) => {
    const senderAddress = await ctx.getSenderAddress();
    if (!senderAddress) return;

    const transfer = createUSDCTransfer(senderAddress, 0.005, true);
    await ctx.conversation.send(transfer, ContentTypeWalletSendCalls);
    await ctx.sendText(
      "😉 Please approve the 0.005 USDC transfer with rich metadata!",
    );
  });

  registerAction("transaction-actions", async (ctx) => {
    const actions = ActionBuilder.create(
      "transaction-actions",
      "Choose a transaction action:",
    )
      .add("send-small", "Send 0.005 USDC")
      .add("send-large", "Send 1 USDC")
      .add("send-with-metadata", "Send with Metadata")
      .add("check-balance", "Check Balance")
      .build();

    await sendActions(ctx, actions);
  });

  registerAction("more-info", async (ctx) => {
    const infoMessage = `ℹ️ Network Information

CURRENT NETWORK:
• Name: ${networkConfig.networkName}
• Network ID: ${networkConfig.networkId}
• Chain ID: ${networkConfig.chainId}
• USDC Address: ${networkConfig.tokenAddress}

FEATURES:
• Wallet Send Calls (EIP-5792)
• Inline Actions (XIP-67)

🔗 Test at: https://xmtp.chat`;

    await ctx.sendText(infoMessage);
  });

  // Use the inline actions middleware
  agent.use(inlineActionsMiddleware);

  // Handle text messages with simple commands
  agent.on("text", async (ctx) => {
    if (!ctx.message.content.startsWith("/")) return;

    const actions = ActionBuilder.create(
      "help",
      `👋 Welcome to Inline Actions Demo!

I can help you with USDC transactions on ${networkConfig.networkName}.

Choose an action below:`,
    )
      .add("transaction-actions", "💸 Transaction Actions")
      .add("send-with-metadata", "😉 Send with Metadata")
      .add("check-balance", "Check Balance")
      .add("more-info", "ℹ️ More Info")
      .build();

    await sendActions(ctx, actions);
  });

  // Handle startup
  agent.on("start", () => {
    console.log(`🤖 Inline Actions Agent is running...`);
    console.log(`Address: ${agentAddress}`);
    console.log(`🔗 ${getTestUrl(agent.client)}`);
    console.log(`Send /help or gm to get started!`);
  });

  // Start the agent
  await agent.start();
}

main().catch(console.error);
