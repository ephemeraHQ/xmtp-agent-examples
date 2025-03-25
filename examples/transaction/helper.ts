import {
  ContentTypeId,
  type ContentCodec,
  type EncodedContent,
} from "@xmtp/content-type-primitives";
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
    ],
  };
}

export const ContentTypeWalletSendCalls = new ContentTypeId({
  authorityId: "xmtp.org",
  typeId: "walletSendCalls",
  versionMajor: 1,
  versionMinor: 0,
});

export type WalletSendCallsParams = {
  version: string;
  chainId: `0x${string}`; // Hex chain id
  from: `0x${string}`;
  calls: {
    to?: `0x${string}` | undefined;
    data?: `0x${string}` | undefined;
    value?: `0x${string}` | undefined; // Hex value
    gas?: `0x${string}` | undefined;
    metadata?: {
      description: string;
      transactionType: string;
    } & Record<string, any>;
  }[];
  capabilities?: Record<string, any> | undefined;
};

export class WalletSendCallsCodec
  implements ContentCodec<WalletSendCallsParams>
{
  get contentType(): ContentTypeId {
    return ContentTypeWalletSendCalls;
  }

  encode(content: WalletSendCallsParams): EncodedContent {
    const encoded = {
      type: ContentTypeWalletSendCalls,
      parameters: {},
      content: new TextEncoder().encode(JSON.stringify(content)),
    };
    return encoded;
  }

  decode(encodedContent: EncodedContent): WalletSendCallsParams {
    const uint8Array = encodedContent.content;
    const contentReceived = JSON.parse(
      new TextDecoder().decode(uint8Array),
    ) as WalletSendCallsParams;
    return contentReceived;
  }

  fallback(content: WalletSendCallsParams): string | undefined {
    return `[Crypto transaction request generated]: ${JSON.stringify(content)}`;
  }

  shouldPush() {
    return true;
  }
}
