import { validateEnvironment } from "@helpers/client";
import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { createPublicClient, formatUnits, http, toHex } from "viem";
import { base, baseSepolia } from "viem/chains";

const { NETWORK_ID } = validateEnvironment(["NETWORK_ID"]);

// Configuration constants
const networks = [
  {
    tokenAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    chainId: toHex(84532), // Base Sepolia network ID (84532 in hex)
    decimals: 6,
    networkName: "Base Sepolia",
    networkId: "base-sepolia",
  },
  {
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base Mainnet
    chainId: toHex(8453), // Base Mainnet network ID (8453 in hex)
    decimals: 6,
    networkName: "Base Mainnet",
    networkId: "base-mainnet",
  },
];

// Create a public client for reading from the blockchain
const publicClient = createPublicClient({
  chain: NETWORK_ID === "base-mainnet" ? base : baseSepolia,
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
    address: networks.find((network) => network.networkId === NETWORK_ID)
      ?.tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });

  return formatUnits(
    balance,
    networks.find((network) => network.networkId === NETWORK_ID)?.decimals ?? 6,
  );
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

  const config = networks.find((network) => network.networkId === NETWORK_ID);
  if (!config) {
    throw new Error("Network not found");
  }
  return {
    version: "1.0",
    from: fromAddress as `0x${string}`,
    chainId: config.chainId,
    calls: [
      {
        to: config.tokenAddress as `0x${string}`,
        data: transactionData as `0x${string}`,
        metadata: {
          description: `Transfer ${amount / Math.pow(10, config.decimals)} USDC on ${config.networkName}`,
          transactionType: "transfer",
          currency: "USDC",
          amount: amount,
          decimals: config.decimals,
          networkId: config.networkId,
        },
      },
      /* add more calls here */
    ],
  };
}
