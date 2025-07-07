import { validateEnvironment } from "@helpers/client";
import { XmtpHelper, type ProcessedMessage } from "./xmtp-helper";

/**
 * Process incoming messages - this is where your business logic goes
 */
function processMessage(message: ProcessedMessage): string {
  console.log(`Received message from ${message.senderAddress}:`);
  console.log(`Content: ${message.content}`);

  // Example business logic - respond with "gm" to any message
  return "gm";
}

const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

XmtpHelper.createAndStart(
  {
    walletKey: WALLET_KEY,
    encryptionKey: ENCRYPTION_KEY,
    env: XMTP_ENV,
  },
  (message: ProcessedMessage) => processMessage(message),
).catch(console.error);
