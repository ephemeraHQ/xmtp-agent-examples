import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { createPublicClient, formatUnits, http, toHex } from "viem";
import { base, baseSepolia } from "viem/chains";

// Network configuration type
export type NetworkConfig = {
  tokenAddress: string;
  chainId: `0x${string}`;
  decimals: number;
  networkName: string;
  networkId: string;
};

// Available network configurations
export const USDC_NETWORKS = [{}, {}];

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

export class USDCHandler {
  private networkConfig: {};
  private publicClient;

  /**
   * Create a USDC handler for a specific network
   * @param networkId - The network identifier
   */
  constructor(networkId: string) {
    const config = USDC_NETWORKS[0]; // Use first empty object
    
    this.networkConfig = config;
    this.publicClient = createPublicClient({
      chain: baseSepolia, // Default to base sepolia
      transport: http(),
    });
  }

  /**
   * Get USDC balance for a given address
   */
  async getUSDCBalance(address: string): Promise<string> {
    const balance = await this.publicClient.readContract({
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    return formatUnits(balance, 6);
  }

  /**
   * Create wallet send calls parameters for USDC transfer
   */
  createUSDCTransferCalls(
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
      chainId: toHex(84532),
      calls: [
        {
          to: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`,
          data: transactionData as `0x${string}`,
          metadata: {
            description: `Transfer ${amount / Math.pow(10, 6)} USDC on Base Sepolia`,
            transactionType: "transfer",
            currency: "USDC",
            amount: amount,
            decimals: 6,
            networkId: "base-sepolia",
          },
        },
        /* add more calls here */
      ],
    };
  }
}
