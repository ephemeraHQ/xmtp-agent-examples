import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

// Check Node.js version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major < 20) {
  console.error("Error: Node.js version 20 or higher is required");
  process.exit(1);
}

async function main() {
  // Get inbox ID and revoke count from command line arguments
  const inboxId = process.argv[2];
  const revokeCount = process.argv[3];

  if (!inboxId) {
    console.error("Error: Inbox ID is required as a command line argument");
    console.error("Usage: yarn revoke-installations <inbox-id> [revoke-count]");
    console.error(
      "Example: yarn revoke-installations 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 3",
    );
    process.exit(1);
  }

  // Parse revoke count, default to automatic calculation if not provided
  const maxInstallations = "5"; // protocol limit
  const installationsToRevoke = revokeCount ? parseInt(revokeCount) : null;

  if (
    installationsToRevoke !== null &&
    (isNaN(installationsToRevoke) || installationsToRevoke < 0)
  ) {
    console.error("Error: Revoke count must be a positive number");
    process.exit(1);
  }

  // Get the current working directory (should be the example directory)
  const exampleDir = process.cwd();
  const exampleName = exampleDir.split("/").pop() || "example";
  const envPath = join(exampleDir, ".env");

  console.log(`Looking for .env file in: ${exampleDir}`);

  // Check if .env file exists
  if (!existsSync(envPath)) {
    console.error(
      "Error: .env file not found. Please run 'yarn gen:keys' first to generate keys.",
    );
    process.exit(1);
  }

  // Read and parse .env file
  const envContent = await readFile(envPath, "utf-8");
  const envVars: Record<string, string> = {};

  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value && !key.startsWith("#")) {
      envVars[key.trim()] = value.trim();
    }
  });

  // Validate required environment variables
  const requiredVars = ["WALLET_KEY", "ENCRYPTION_KEY", "XMTP_ENV"];
  const missingVars = requiredVars.filter((varName) => !envVars[varName]);

  if (missingVars.length > 0) {
    console.error(
      `Error: Missing required environment variables: ${missingVars.join(", ")}`,
    );
    console.error("Please run 'yarn gen:keys' first to generate keys.");
    process.exit(1);
  }

  console.log(`Revoking installations for ${exampleName}...`);
  console.log(`Inbox ID: ${inboxId}`);
  console.log(`Max installations: ${maxInstallations}`);
  console.log(`Environment: ${envVars.XMTP_ENV}`);
  if (installationsToRevoke !== null) {
    console.log(`Manual revoke count: ${installationsToRevoke}`);
  }

  try {
    // Create signer and encryption key
    const signer = createSigner(envVars.WALLET_KEY as `0x${string}`);
    const dbEncryptionKey = getEncryptionKeyFromHex(envVars.ENCRYPTION_KEY);

    // Get current inbox state
    const inboxState = await Client.inboxStateFromInboxIds(
      [inboxId],
      envVars.XMTP_ENV as XmtpEnv,
    );

    const currentInstallations = inboxState[0].installations;
    console.log(`✓ Current installations: ${currentInstallations.length}`);

    // Determine how many installations to revoke
    let countToRevoke: number;
    let reason: string;

    if (installationsToRevoke !== null) {
      // Use manual count if provided
      countToRevoke = Math.min(
        installationsToRevoke,
        currentInstallations.length,
      );
      reason = `manual request (${installationsToRevoke})`;
    } else {
      // Use automatic calculation if at or over the limit
      if (currentInstallations.length >= parseInt(maxInstallations)) {
        countToRevoke =
          currentInstallations.length - parseInt(maxInstallations) + 1;
        reason = `automatic (exceeds limit of ${maxInstallations})`;
      } else {
        countToRevoke = 0;
        reason = `none needed (${currentInstallations.length} < ${maxInstallations})`;
      }
    }

    if (countToRevoke > 0) {
      // Revoke the oldest installations first (slice from beginning of array)
      const installationsToRevokeBytes = currentInstallations
        .slice(0, countToRevoke)
        .map((installation) => installation.bytes);

      console.log(
        `Revoking ${countToRevoke} oldest installations (${reason})...`,
      );

      await Client.revokeInstallations(
        signer,
        inboxId,
        installationsToRevokeBytes,
        envVars.XMTP_ENV as XmtpEnv,
      );

      console.log(`✓ Revoked ${countToRevoke} installations`);
    } else {
      console.log(`✓ No installations need to be revoked (${reason})`);
    }

    // Create new client to verify the state
    const client = await Client.create(signer, {
      dbEncryptionKey,
      env: envVars.XMTP_ENV as XmtpEnv,
    });

    const finalState = await client.preferences.inboxState(true);
    console.log(`✓ Final installations: ${finalState.installations.length}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error revoking installations:", errorMessage);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
