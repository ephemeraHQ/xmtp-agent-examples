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

XmtpHelper.createAndStart(
  {
    walletKey: process.env.WALLET_KEY as string,
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    env: process.env.XMTP_ENV as string,
  },
  (message: ProcessedMessage) => processMessage(message),
).catch(console.error);
