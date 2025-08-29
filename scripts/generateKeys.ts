#!/usr/bin/env node

/**
 * Key generation script that uses the @xmtp/agent-sdk's generateKeys functionality
 * This script is referenced by all example package.json files
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // Get the root directory (one level up from scripts/)
    const rootDir = path.resolve(__dirname, "..");

    // Path to the agent SDK's generateKeys script
    const agentSdkKeysScript = path.join(
      rootDir,
      "node_modules",
      "@xmtp",
      "agent-sdk",
      "dist",
      "bin",
      "generateKeys.js",
    );

    console.log("🔑 Generating XMTP keys using @xmtp/agent-sdk...");

    // Set the INIT_CWD environment variable that the agent SDK script expects
    const env = {
      ...process.env,
      INIT_CWD: rootDir,
    };

    // Execute the agent SDK's key generation script
    execSync(`node "${agentSdkKeysScript}"`, {
      stdio: "inherit",
      env,
      cwd: rootDir,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error generating keys:", errorMessage);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("❌ Unexpected error:", errorMessage);
  process.exit(1);
});
