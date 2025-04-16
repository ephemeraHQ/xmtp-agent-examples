// CLI script to send a message to a target XMTP address
// Usage: yarn script cli-send <target_address> <message>

import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client, IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";

// Default keys for testing - you should replace these with your own in production
const DEFAULT_WALLET_KEY =
  "0x11567776b95bdbed513330f503741e19877bf7fe73e7957bf6f0ecf3e267fdb8";
const DEFAULT_ENCRYPTION_KEY =
  "11973168e34839f9d31749ad77204359c5c39c404e1154eacb7f35a867ee47de";

async function main(): Promise<void> {
  // Get command line arguments
  const targetAddress = process.argv[2];
  const message = process.argv[3];

  if (!targetAddress || !message) {
    console.error("Usage: yarn script cli-send <target_address> <message>");
    process.exit(1);
  }

  console.log(`Sending message to ${targetAddress}: "${message}"`);

  try {
    // Get keys from environment or use defaults
    const WALLET_KEY = process.env.WALLET_KEY || DEFAULT_WALLET_KEY;
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;

    // Create signer and client
    const signer = createSigner(WALLET_KEY as `0x${string}`);
    const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

    // Create XMTP client
    const client = await Client.create(signer, {
      dbEncryptionKey: encryptionKey,
      env: (process.env.XMTP_ENV || "dev") as XmtpEnv,
    });

    const identifier = await signer.getIdentifier();
    console.log(`Connected as: ${identifier.identifier}`);
    console.log(`Inbox ID: ${client.inboxId}`);

    // Create conversation with the target
    console.log(`Creating conversation with ${targetAddress}...`);
    const conversation = await client.conversations.newDmWithIdentifier({
      identifier: targetAddress,
      identifierKind: IdentifierKind.Ethereum,
    });

    // Send the message
    console.log("Sending message...");
    await conversation.send(message);

    console.log("Message sent successfully!");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending message:", errorMessage);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(errorMessage);
});
