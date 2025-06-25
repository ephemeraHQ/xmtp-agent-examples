import {
  createSigner,
  getEncryptionKeyFromHex,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

const INBOX_ID =
  "459e8174735cecc475d36f1bdf2c39bd1440ed25026440249e379cea18a76a8a";
const MAX_INSTALLATIONS = 5;

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

async function main() {
  const inboxState = await Client.inboxStateFromInboxIds(
    [INBOX_ID],
    XMTP_ENV as XmtpEnv,
  );

  const currentInstallations = inboxState[0].installations;
  console.log(`✓ Current installations: ${currentInstallations.length}`);

  // Only revoke if we're at or over the limit (accounting for new installation)
  if (currentInstallations.length >= MAX_INSTALLATIONS) {
    // Calculate how many to revoke: current count - max allowed + 1 (for the new installation we're about to create)
    // Example: 200 current - 5 max + 1 new = 196 to revoke, leaving 4 + 1 new = 5 total
    const excessCount = currentInstallations.length - MAX_INSTALLATIONS + 1;

    // Revoke the oldest installations first (slice from beginning of array)
    // This preserves the most recent installations which are likely still in use
    const installationsToRevoke = currentInstallations
      .slice(0, excessCount)
      .map((installation) => installation.bytes);

    console.log(`Revoking ${excessCount} oldest installations...`);

    await Client.revokeInstallations(
      signer,
      INBOX_ID,
      installationsToRevoke,
      XMTP_ENV as XmtpEnv,
    );

    console.log(`✓ Revoked ${excessCount} installations`);
  }

  // Create new client (this adds a new installation)
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  const finalState = await client.preferences.inboxState(true);
  console.log(`✓ Final installations: ${finalState.installations.length}`);
}

main().catch(console.error);
