export interface SendCallsRequest {
  from: string;
  to: string;
  amount: number;
  token: string;
  networkId: string;
  includeMetadata?: boolean;
  usePaymaster?: boolean;
}
