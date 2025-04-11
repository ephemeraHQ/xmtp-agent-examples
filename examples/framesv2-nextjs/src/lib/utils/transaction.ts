import { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";

// Configuration constants
export const USDC_CONFIG = {
  tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chainId: "0x2105", // Base network ID (8453 in hex)
  decimals: 6,
  platform: "base",
} as const;

/**
 * Create wallet send calls parameters for USDC transfer
 */
export function createUSDCTransferCalls(
  fromAddress: `0x${string}`,
  recipientAddress: string,
  amount: number,
): WalletSendCallsParams {
  const methodSignature = "0xa9059cbb"; // Function signature for ERC20 'transfer(address,uint256)'

  // Format the transaction data following ERC20 transfer standard
  const transactionData = `${methodSignature}${recipientAddress
    .slice(2)
    .padStart(64, "0")}${BigInt(amount).toString(16).padStart(64, "0")}`;

  return {
    version: "1.0",
    from: fromAddress,
    chainId: USDC_CONFIG.chainId as `0x${string}`,
    calls: [
      {
        to: USDC_CONFIG.tokenAddress as `0x${string}`,
        data: transactionData as `0x${string}`,
        metadata: {
          description: `Transfer ${amount / Math.pow(10, USDC_CONFIG.decimals)} USDC on Base`,
          transactionType: "transfer",
          currency: "USDC",
          amount: amount,
          decimals: USDC_CONFIG.decimals,
          platform: USDC_CONFIG.platform,
        },
      },
      /* add more calls here */
    ],
  };
}
