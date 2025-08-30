import type { AgentContext } from "@xmtp/agent-sdk";
import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { type IntentContent } from "../types/IntentContent";
import {
  handleActionsCommand,
  handleActionsWithImagesCommand,
} from "./actionHandlers";
import { getAvailableNetworks, type TokenHandler } from "./tokenHandler";

export async function handleSendCommand(
  ctx: AgentContext,
  command: string,
  senderAddress: string,
  agentAddress: string,
  tokenHandler: TokenHandler,
  includeMetadata: boolean = false,
  usePaymaster: boolean = false,
) {
  const parts = command.split(" ");
  if (parts.length !== 3) {
    await ctx.conversation.send(
      "❌ Invalid format\n\nUse: /send <AMOUNT> <TOKEN>\nExample: /send 0.1 USDC",
    );
    return;
  }

  const amount = parseFloat(parts[1]);
  const token = parts[2].toUpperCase();

  if (isNaN(amount) || amount <= 0) {
    await ctx.conversation.send(
      "❌ Invalid amount. Please provide a positive number.",
    );
    return;
  }

  try {
    // Validate token is supported
    tokenHandler.getTokenConfig(token);

    const walletSendCalls = tokenHandler.createTokenTransferCalls({
      from: senderAddress,
      to: agentAddress,
      amount: amount,
      token: token,
      networkId: tokenHandler.getNetworkInfo().id,
      includeMetadata,
      usePaymaster,
    });

    console.log(
      `💸 Created transfer request: ${amount} ${token} from ${senderAddress}${usePaymaster ? " with paymaster" : ""}`,
    );
    await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);

    await ctx.conversation.send(
      `✅ Transaction request created!

DETAILS:
• Amount: ${amount} ${token}
• To: ${agentAddress}
• Network: ${tokenHandler.getNetworkInfo().name}${usePaymaster ? "\n• Paymaster: Enabled (gas fees sponsored)\n• Rich Metadata: Included automatically" : ""}${includeMetadata && !usePaymaster ? "\n• Rich Metadata: Included" : ""}

💡 Please approve the transaction in your wallet.
📋 Optionally share the transaction reference when complete.`,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Enhanced error handling for wallet send calls
    if (
      errorMessage.toLowerCase().includes("insufficient gas") ||
      errorMessage.toLowerCase().includes("out of gas") ||
      errorMessage.toLowerCase().includes("gas limit") ||
      errorMessage.toLowerCase().includes("intrinsic gas too low") ||
      errorMessage.toLowerCase().includes("gas required exceeds allowance")
    ) {
      console.error(`⛽ Gas error for wallet send calls: ${errorMessage}`);
      await ctx.conversation
        .send(`⛽ **Gas Error**: Transaction cannot be prepared due to insufficient gas.

**Details**: ${errorMessage}

**Solutions**:
• Increase gas limit in your wallet
• Ensure you have enough ETH for gas fees
• Try a smaller transaction amount`);
    } else if (
      errorMessage.toLowerCase().includes("insufficient funds") ||
      errorMessage.toLowerCase().includes("insufficient balance")
    ) {
      console.error(
        `💰 Insufficient funds error for wallet send calls: ${errorMessage}`,
      );
      await ctx.conversation.send(`💰 **Insufficient Funds**: ${errorMessage}

**Solutions**:
• Check your wallet balance
• Ensure you have enough tokens + gas fees`);
    } else {
      console.error(`❌ Wallet send calls error: ${errorMessage}`);
      await ctx.conversation.send(`❌ ${errorMessage}`);
    }
  }
}

export async function handleBalanceCommand(
  ctx: AgentContext,
  command: string,
  agentAddress: string,
  tokenHandler: TokenHandler,
) {
  const parts = command.split(" ");
  if (parts.length !== 2) {
    await ctx.conversation.send(
      "❌ Invalid format\n\nUse: /balance <TOKEN>\nExample: /balance USDC",
    );
    return;
  }

  const token = parts[1].toUpperCase();

  try {
    const balance = await tokenHandler.getTokenBalance(agentAddress, token);
    await ctx.conversation.send(
      `💰 Bot Balance

Token: ${token}
Balance: ${balance} ${token}
Network: ${tokenHandler.getNetworkInfo().name}`,
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ctx.conversation.send(`❌ ${errorMessage}`);
  }
}

export async function handleInfoCommand(
  ctx: AgentContext,
  tokenHandler: TokenHandler,
) {
  const networkInfo = tokenHandler.getNetworkInfo();
  const availableNetworks = getAvailableNetworks();

  const infoMessage = `ℹ️ Network Information

CURRENT NETWORK:
• Name: ${networkInfo.name}
• ID: ${networkInfo.id} 
• Chain ID: ${networkInfo.chainId}

SUPPORTED TOKENS:
${networkInfo.supportedTokens.map((token) => `• ${token}`).join("\n")}

AVAILABLE NETWORKS:
${availableNetworks.map((net) => `• ${net}`).join("\n")}

CONTENT TYPES:
• Wallet Send Calls (EIP-5792)
• Transaction Reference
• Inline Actions
• Paymaster Service Capability

🔗 Test at: https://xmtp.chat`;

  await ctx.conversation.send(infoMessage);
}

export async function handleIntentMessage(
  ctx: AgentContext,
  intentContent: IntentContent,
  senderAddress: string,
  agentAddress: string,
  tokenHandler: TokenHandler,
) {
  console.log(
    `🎯 Processing intent: ${intentContent.actionId} for actions: ${intentContent.id}`,
  );

  try {
    switch (intentContent.actionId) {
      case "show-actions":
        console.log("🎯 Processing show actions request");
        await handleActionsCommand(ctx);
        break;

      case "show-actions-with-images":
        console.log("🎯 Processing show actions with images request");
        await handleActionsWithImagesCommand(ctx);
        break;

      case "transaction-with-metadata":
        console.log("🎯 Processing transaction with metadata request");
        await handleSendCommand(
          ctx,
          "/send 0.005 USDC",
          senderAddress,
          agentAddress,
          tokenHandler,
          true,
        );
        break;

      case "transact-with-paymaster":
        console.log("💳 Processing paymaster transaction request");
        await handleSendCommand(
          ctx,
          "/send 0.005 USDC",
          senderAddress,
          agentAddress,
          tokenHandler,
          true, // Include metadata when using paymaster
          true, // Enable paymaster
        );
        break;

      case "check-balance":
        console.log("💰 Processing balance check request");
        await handleBalanceCommand(
          ctx,
          "/balance USDC",
          agentAddress,
          tokenHandler,
        );
        break;

      case "more-info":
        console.log("ℹ️ Processing more info request");
        await handleInfoCommand(ctx, tokenHandler);
        break;

      case "send-small":
        console.log("💸 Processing small USDC send request");
        await handleSendCommand(
          ctx,
          "/send 0.005 USDC",
          senderAddress,
          agentAddress,
          tokenHandler,
        );
        break;

      case "send-large":
        console.log("💸 Processing large USDC send request");
        await handleSendCommand(
          ctx,
          "/send 1 USDC",
          senderAddress,
          agentAddress,
          tokenHandler,
        );
        break;

      default:
        await ctx.conversation.send(
          `❌ Unknown action: ${intentContent.actionId}`,
        );
        console.log(`❌ Unknown action ID: ${intentContent.actionId}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error processing intent:", errorMessage);
    await ctx.conversation.send(`❌ Error processing action: ${errorMessage}`);
  }
}
