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

export interface TransactionMetadata {
  description: string;
  transactionType: "transfer" | "swap" | "stake" | "unstake" | "mint" | "burn";
  currency: string;
  amount: number;
  decimals: number;
  networkId: string;
}

export interface SendCallsRequest {
  from: string;
  to: string;
  amount: number;
  token: string;
  networkId: string;
  includeMetadata?: boolean;
  usePaymaster?: boolean;
}
