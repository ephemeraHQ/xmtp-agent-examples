import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { createPublicClient, formatUnits, http } from "viem";
import { baseSepolia } from "viem/chains";

// Configuration constants
export const USDC_CONFIG = {
  tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  chainId: "0x14A34", // Base Sepolia network ID (84532 in hex)
  decimals: 6,
  platform: "base",
} as const;

// Create a public client for reading from the blockchain
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// ERC20 minimal ABI for balance checking
const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Get USDC balance for a given address
 */
export async function getUSDCBalance(address: string): Promise<string> {
  const balance = await publicClient.readContract({
    address: USDC_CONFIG.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  return formatUnits(balance, USDC_CONFIG.decimals);
}

/**
 * Create wallet send calls parameters for USDC transfer
 */
export function createUSDCTransferCalls(
  fromAddress: string,
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
    from: fromAddress as `0x${string}`,
    chainId: USDC_CONFIG.chainId as `0x${string}`,
    calls: [
      {
        to: USDC_CONFIG.tokenAddress as `0x${string}`,
        data: transactionData as `0x${string}`,
        metadata: {
          description: `Transfer ${amount / Math.pow(10, USDC_CONFIG.decimals)} USDC on Base Sepolia`,
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
