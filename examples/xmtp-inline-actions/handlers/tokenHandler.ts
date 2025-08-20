import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { createPublicClient, formatUnits, http, toHex } from "viem";
import { base, baseSepolia, mainnet, sepolia } from "viem/chains";

export interface SendCallsRequest {
  from: string;
  to: string;
  amount: number;
  token: string;
  networkId: string;
  includeMetadata?: boolean;
  usePaymaster?: boolean;
}

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  networks: string[];
}

export interface NetworkConfig {
  id: string;
  name: string;
  chainId: `0x${string}`;
  nativeToken: string;
  tokens: Record<string, TokenConfig>;
}

const hostname = "tba.chat";
const faviconUrl =
  "https://www.google.com/s2/favicons?sz=256&domain_url=https%3A%2F%2Fwww.coinbase.com%2Fwallet";
const title = "TBA Chat Agent";
const paymasterUrl =
  "https://api.developer.coinbase.com/rpc/v1/base/DwomRfA4eBFEJgn4fZSwHjf934akZLtG";

// ERC20 minimal ABI for balance checking
const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Network configurations
const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  "base-sepolia": {
    id: "base-sepolia",
    name: "Base Sepolia",
    chainId: toHex(84532),
    nativeToken: "ETH",
    tokens: {
      USDC: {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        decimals: 6,
        networks: ["base-sepolia"],
      },
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x0000000000000000000000000000000000000000", // Native token
        decimals: 18,
        networks: ["base-sepolia"],
      },
    },
  },
  "base-mainnet": {
    id: "base-mainnet",
    name: "Base Mainnet",
    chainId: toHex(8453),
    nativeToken: "ETH",
    tokens: {
      USDC: {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        networks: ["base-mainnet"],
      },
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        networks: ["base-mainnet"],
      },
    },
  },
  "ethereum-sepolia": {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    chainId: toHex(11155111),
    nativeToken: "ETH",
    tokens: {
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        networks: ["ethereum-sepolia"],
      },
    },
  },
  "ethereum-mainnet": {
    id: "ethereum-mainnet",
    name: "Ethereum Mainnet",
    chainId: toHex(1),
    nativeToken: "ETH",
    tokens: {
      USDC: {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xA0b86a33E6441d548b64E4a9d0C9C92C8c7e8E1b",
        decimals: 6,
        networks: ["ethereum-mainnet"],
      },
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        networks: ["ethereum-mainnet"],
      },
    },
  },
};

export class TokenHandler {
  private networkConfig: NetworkConfig;
  private publicClient;

  constructor(networkId: keyof typeof NETWORK_CONFIGS) {
    const config = NETWORK_CONFIGS[networkId];
    this.networkConfig = config;
    this.publicClient = createPublicClient({
      chain: this.getViemChain(networkId),
      transport: http(),
    });
  }

  private getViemChain(networkId: string) {
    switch (networkId) {
      case "base-sepolia":
        return baseSepolia;
      case "base-mainnet":
        return base;
      case "ethereum-sepolia":
        return sepolia;
      case "ethereum-mainnet":
        return mainnet;
      default:
        throw new Error(`Unsupported network: ${networkId}`);
    }
  }

  /**
   * Get token configuration by symbol
   */
  getTokenConfig(symbol: keyof typeof this.networkConfig.tokens): TokenConfig {
    const token = this.networkConfig.tokens[symbol.toUpperCase()];
    return token;
  }

  /**
   * Get balance for a token
   */
  async getTokenBalance(address: string, tokenSymbol: string): Promise<string> {
    const token = this.getTokenConfig(tokenSymbol);

    if (
      token.symbol === "ETH" &&
      token.address === "0x0000000000000000000000000000000000000000"
    ) {
      // Native ETH balance
      const balance = await this.publicClient.getBalance({
        address: address as `0x${string}`,
      });
      return formatUnits(balance, token.decimals);
    } else {
      // ERC20 token balance
      const balance = await this.publicClient.readContract({
        address: token.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      return formatUnits(balance, token.decimals);
    }
  }

  /**
   * Create wallet send calls for token transfer
   */
  createTokenTransferCalls(request: SendCallsRequest): WalletSendCallsParams {
    const token = this.getTokenConfig(request.token);
    const amountInDecimals = Math.floor(
      request.amount * Math.pow(10, token.decimals),
    );

    const capabilities = request.usePaymaster
      ? {
          paymasterService: {
            url: paymasterUrl,
            optional: true,
          },
        }
      : undefined;

    // Automatically include metadata when using paymaster for richer transaction information
    const shouldIncludeMetadata =
      request.includeMetadata || request.usePaymaster;

    if (
      token.symbol === "ETH" &&
      token.address === "0x0000000000000000000000000000000000000000"
    ) {
      // Native ETH transfer
      return {
        version: "1.0",
        from: request.from as `0x${string}`,
        chainId: this.networkConfig.chainId,
        ...(capabilities && { capabilities }),
        calls: [
          {
            to: request.to as `0x${string}`,
            value: toHex(BigInt(amountInDecimals)),
            data: "0x",
            metadata: {
              description: `Transfer ${request.amount} ${token.symbol} on ${this.networkConfig.name}`,
              transactionType: "transfer",
              currency: token.symbol,
              amount: amountInDecimals,
              decimals: token.decimals,
              networkId: this.networkConfig.id,
              ...(shouldIncludeMetadata
                ? {
                    hostname,
                    faviconUrl,
                    title,
                  }
                : {}),
            },
          },
        ],
      };
    } else {
      // ERC20 token transfer
      const methodSignature = "0xa9059cbb"; // transfer(address,uint256)
      const transactionData = `${methodSignature}${request.to
        .slice(2)
        .padStart(
          64,
          "0",
        )}${BigInt(amountInDecimals).toString(16).padStart(64, "0")}`;

      return {
        version: "1.0",
        from: request.from as `0x${string}`,
        chainId: this.networkConfig.chainId,
        ...(capabilities && { capabilities }),
        calls: [
          {
            to: token.address as `0x${string}`,
            data: transactionData as `0x${string}`,
            metadata: {
              description: `Transfer ${request.amount} ${token.symbol} on ${this.networkConfig.name}`,
              transactionType: "transfer",
              currency: token.symbol,
              amount: amountInDecimals,
              decimals: token.decimals,
              networkId: this.networkConfig.id,
              ...(shouldIncludeMetadata
                ? {
                    hostname,
                    faviconUrl,
                    title,
                  }
                : {}),
            },
          },
        ],
      };
    }
  }

  /**
   * Get all supported tokens for this network
   */
  getSupportedTokens(): string[] {
    return Object.keys(this.networkConfig.tokens);
  }

  /**
   * Get network information
   */
  getNetworkInfo() {
    return {
      id: this.networkConfig.id,
      name: this.networkConfig.name,
      chainId: this.networkConfig.chainId,
      supportedTokens: this.getSupportedTokens(),
    };
  }
}

/**
 * Get all available networks
 */
export function getAvailableNetworks(): string[] {
  return Object.keys(NETWORK_CONFIGS);
}

/**
 * Check if a network is supported
 */
export function isNetworkSupported(networkId: string): boolean {
  return networkId in NETWORK_CONFIGS;
}
