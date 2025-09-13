import type { TransactionReference } from "@xmtp/content-type-transaction-reference";
import type { Conversation } from "@xmtp/node-sdk";
import type { TokenHandler } from "./tokenHandler";

// Type definitions for the nested TransactionReference structure
interface TransactionMetadata {
  transactionType?: string;
  fromAddress?: string;
  toAddress?: string;
  currency?: string;
  amount?: number;
  decimals?: number;
  [key: string]: unknown;
}

interface TransactionRefData {
  reference?: string;
  networkId?: string | number;
  metadata?: TransactionMetadata;
}

export interface ExtendedTransactionReference extends TransactionReference {
  transactionReference?: TransactionRefData;
}

export async function handleTransactionReference(
  conversation: Conversation,
  transactionRef: ExtendedTransactionReference,
  senderAddress: string,
  tokenHandler: TokenHandler,
) {
  console.log("🧾 Processing transaction reference:", transactionRef);
  console.log(
    "📊 Full transaction reference object:",
    JSON.stringify(transactionRef, null, 2),
  );

  const networkInfo = tokenHandler.getNetworkInfo();

  // Extract transaction details from the TransactionReference object
  const txRef = transactionRef.transactionReference;
  const txHash = txRef?.reference || "unknown";
  const networkId = txRef?.networkId?.toString() || "unknown";
  const metadata = txRef?.metadata;

  console.log("🔍 Extracted data:");
  console.log(`  • txHash: ${txHash}`);
  console.log(`  • networkId: ${networkId}`);
  console.log(
    `  • metadata:`,
    metadata ? JSON.stringify(metadata, null, 4) : "null",
  );
  console.log(`  • senderAddress: ${senderAddress}`);
  console.log(`  • currentNetwork: ${networkInfo.name} (${networkInfo.id})`);
  console.log(`  • txData structure:`, JSON.stringify(transactionRef, null, 2));

  let receiptMessage = `📋 Transaction Reference Received

TRANSACTION DETAILS:
• Transaction Hash: ${txHash}
• Network ID: ${networkId}
• Transaction Type: ${metadata?.transactionType || "Unknown"}
• From Address: ${metadata?.fromAddress || senderAddress}
• Current Network: ${networkInfo.name} (${networkInfo.id})`;

  // Add additional metadata information if available
  if (metadata) {
    receiptMessage += `\n\nADDITIONAL INFO:`;
    if (metadata.currency && metadata.amount && metadata.decimals) {
      const amount = metadata.amount / Math.pow(10, metadata.decimals);
      receiptMessage += `\n• Amount: ${amount} ${metadata.currency}`;
    }
    if (metadata.toAddress) {
      receiptMessage += `\n• To Address: ${metadata.toAddress}`;
    }
    // Add any other metadata fields that might be present
    const excludeFields = [
      "transactionType",
      "fromAddress",
      "currency",
      "amount",
      "decimals",
      "toAddress",
    ];
    Object.entries(metadata).forEach(([key, value]) => {
      if (!excludeFields.includes(key)) {
        receiptMessage += `\n• ${key}: ${String(value)}`;
      }
    });
  }

  receiptMessage += `\n\n🔗 View on explorer:\n${getExplorerUrl(txHash, networkId || networkInfo.id)}`;
  receiptMessage += `\n\n✅ Thank you for sharing the transaction details!`;

  console.log("📤 Sending transaction reference response to user");
  await conversation.send(receiptMessage);
  console.log("✅ Transaction reference processing completed successfully");
}

export function getExplorerUrl(txHash: string, networkId: string): string {
  // Handle hex chain IDs
  const chainId = networkId.startsWith("0x")
    ? parseInt(networkId, 16)
    : networkId;

  switch (chainId) {
    case 8453:
    case "8453":
    case "base-mainnet":
      return `https://basescan.org/tx/${txHash}`;
    case 84532:
    case "84532":
    case "base-sepolia":
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case 1:
    case "1":
    case "ethereum-mainnet":
      return `https://etherscan.io/tx/${txHash}`;
    case 11155111:
    case "11155111":
    case "ethereum-sepolia":
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    default:
      console.log(
        `Unknown network ID: ${networkId} (chainId: ${chainId}), defaulting to etherscan`,
      );
      return `https://etherscan.io/tx/${txHash}`;
  }
}
