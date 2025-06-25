import {
  createSigner,
  getEncryptionKeyFromHex,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

const INBOX_ID =
  "e3f6b9e01dac4bb3c4c5d96f856151f69b73433b868c3f1239cc82e2b0270e8b";
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
  console.log(`Current installations: ${currentInstallations.length}`);

  // Only revoke if we're at or over the limit (accounting for new installation)
  if (currentInstallations.length >= MAX_INSTALLATIONS) {
    const excessCount = currentInstallations.length - MAX_INSTALLATIONS + 1;
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

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  const finalState = await client.preferences.inboxState(true);
  console.log(`✓ Final installations: ${finalState.installations.length}`);
}

main().catch(console.error);
