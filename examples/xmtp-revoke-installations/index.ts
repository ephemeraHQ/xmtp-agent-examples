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

  if (inboxState[0].installations.length >= MAX_INSTALLATIONS) {
    console.log(
      `${inboxState[0].installations.length} detected, revoking all other installations`,
    );
    const installationsBytes = inboxState[0].installations.map(
      (installation) => installation.bytes,
    );
    await Client.revokeInstallations(
      signer,
      INBOX_ID,
      installationsBytes,
      XMTP_ENV as XmtpEnv,
    );
    console.log(`${inboxState[0].installations.length} installations revoked`);
  }

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });
  const installations = await client.preferences.inboxState(true);
  console.log(`✓ Installations: ${installations.installations.length}`);
}

main().catch(console.error);
