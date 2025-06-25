import {
  createSigner,
  getEncryptionKeyFromHex,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

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
    ["e3f6b9e01dac4bb3c4c5d96f856151f69b73433b868c3f1239cc82e2b0270e8b"],
    XMTP_ENV as XmtpEnv,
  );

  if (inboxState[0].installations.length > 4) {
    console.log(
      `${inboxState[0].installations.length} detected, revoking all other installations`,
    );
    await Client.revokeInstallations(
      signer,
      "e3f6b9e01dac4bb3c4c5d96f856151f69b73433b868c3f1239cc82e2b0270e8b",
      inboxState[0].installations.map((installation) => installation.bytes),
      XMTP_ENV as XmtpEnv,
    );
    console.log(`${inboxState[0].installations.length} installations revoked`);
  }

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });
  const installations = await client.preferences.inboxState();
  console.log(`✓ Installations: ${installations.installations.length}`);
}

main().catch(console.error);
