import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as crypto from "crypto";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root directory (2 levels up from the scripts directory when running from source)
const projectRoot = path.resolve(__dirname, "../");

/**
 * Generate random keys for the agent
 * @returns Object containing random wallet and encryption keys
 */
function generateRandomKeys() {
  // This is used for development/testing only
  const randomBytes = crypto.randomBytes(32);
  const walletKey = `0x${randomBytes.toString('hex')}`;

  const randomBytesForEncryption = crypto.randomBytes(32);
  const encryptionKey = `0x${randomBytesForEncryption.toString('hex')}`;

  return { walletKey, encryptionKey };
}

function main() {
  try {
    console.log("🔑 Generating random XMTP keys for your CoinToss agent...");

    // Generate random keys
    const { walletKey, encryptionKey } = generateRandomKeys();

    // Create .env if it doesn't exist - use absolute path from project root
    // When running from dist/scripts, we need to go up one more level
    const isRunningFromDist = __dirname.includes('/dist/') || __dirname.includes('\\dist\\');
    const envPath = isRunningFromDist 
      ? path.resolve(__dirname, "../../.env") 
      : path.resolve(projectRoot, ".env");
      
    console.log(`📂 Environment file path: ${envPath}`);
    
    let envContent = "";
    let envExists = false;

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
      envExists = true;
      console.log("📝 Found existing .env file, updating with new keys...");
    } else {
      console.log("📝 Creating new .env file with generated keys...");
    }

    // Add or update keys in .env
    const envLines = envContent.split("\n");
    const updatedEnvLines: string[] = [];

    let walletKeySet = false;
    let encryptionKeySet = false;

    for (const line of envLines) {
      if (line.startsWith("WALLET_KEY=")) {
        updatedEnvLines.push(`WALLET_KEY=${walletKey}`);
        walletKeySet = true;
      } else if (line.startsWith("ENCRYPTION_KEY=")) {
        updatedEnvLines.push(`ENCRYPTION_KEY=${encryptionKey}`);
        encryptionKeySet = true;
      } else if (line.trim()) {
        updatedEnvLines.push(line);
      }
    }

    if (!walletKeySet) {
      updatedEnvLines.push(`WALLET_KEY=${walletKey}`);
    }

    if (!encryptionKeySet) {
      updatedEnvLines.push(`ENCRYPTION_KEY=${encryptionKey}`);
    }

    // Make sure we have newlines at the end of each line
    const finalEnvContent = updatedEnvLines.join("\n") + "\n";
    
    // Write updated .env file
    console.log(`📝 Writing ${finalEnvContent.length} bytes to .env file...`);
    fs.writeFileSync(envPath, finalEnvContent);
    
    // Verify the file was written
    if (fs.existsSync(envPath)) {
      const writtenContent = fs.readFileSync(envPath, "utf8");
      console.log(`✅ Verified .env file: ${writtenContent.length} bytes written`);
      
      // Double-check keys were added
      if (writtenContent.includes(`WALLET_KEY=${walletKey}`) && 
          writtenContent.includes(`ENCRYPTION_KEY=${encryptionKey}`)) {
        console.log("✅ Keys successfully added to .env file");
      } else {
        console.log("❌ Keys verification failed! Manual check needed.");
      }
    } else {
      console.log("❌ Failed to create .env file! Check permissions and path.");
    }

    console.log("\n✅ Successfully generated and saved new keys to .env!");
    console.log("\n📋 Your XMTP keys:");
    console.log(`WALLET_KEY=${walletKey}`);
    console.log(`ENCRYPTION_KEY=${encryptionKey}`);

    console.log("\n🚀 Next steps:");
    if (!envExists) {
      console.log("1. Add your OpenAI API key to the .env file:");
      console.log("   OPENAI_API_KEY=your_openai_api_key_here");
      console.log("2. Add your Coinbase Developer Platform credentials:");
      console.log("   CDP_API_KEY_NAME=your_cdp_api_key_name_here");
      console.log(
        "   CDP_API_KEY_PRIVATE_KEY=your_cdp_api_key_private_key_here",
      );
      console.log(
        "3. (Optional) Add your Redis URL if you want to use Redis for storage:",
      );
      console.log("   REDIS_URL=your_redis_url_here");
    }
    console.log(`4. Start your CoinToss agent with: yarn start`);
    console.log("\n📚 For more information, check the README.md file.");
  } catch (error) {
    console.error("❌ Error generating keys:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Call main directly since this is the entry point
main();
