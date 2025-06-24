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
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });
  const installations = await client.preferences.inboxState();
  if (installations.installations.length > 4) {
    console.log(
      `${installations.installations.length} detected, revoking all other installations`,
    );
    console.log("uncomment this to revoke all other installations");

    // uncomment this to revoke all other installations
    //await client.revokeAllOtherInstallations();
  }
  console.log(`✓ Installations: ${installations.installations.length}`);
}

main().catch(console.error);
