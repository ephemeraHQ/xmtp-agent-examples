#!/usr/bin/env tsx
/**
 * XMTP Agent Manager Script
 * This TypeScript script handles running, logging, and managing XMTP agents
 */
import { exec, spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client, IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";

// Default keys for testing - you should replace these with your own in production
const DEFAULT_WALLET_KEY =
  "0x11567776b95bdbed513330f503741e19877bf7fe73e7957bf6f0ecf3e267fdb8";
const DEFAULT_ENCRYPTION_KEY =
  "11973168e34839f9d31749ad77204359c5c39c404e1154eacb7f35a867ee47de";

// Set working directory to the current directory
const AGENT_DIR = process.cwd();
// Get project root directory (2 levels up from scripts folder)
const PROJECT_ROOT = join(__dirname, "..");
const TMP_DIR = join(PROJECT_ROOT, ".tmp");
const AGENT_NAME = AGENT_DIR.split("/").pop() || "default-agent";
const TMP_AGENT_DIR = join(TMP_DIR, AGENT_NAME);

// Create tmp directories if they don't exist
if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}
if (!existsSync(TMP_AGENT_DIR)) {
  mkdirSync(TMP_AGENT_DIR, { recursive: true });
}

const LOG_FILE = join(TMP_AGENT_DIR, "agent.log");
const PID_FILE = join(TMP_AGENT_DIR, "agent.pid");

// Function to wait for specified milliseconds
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Show usage function
function showUsage(): void {
  console.log("XMTP Agent Manager");
  console.log("Usage:");
  console.log(
    `  ${process.argv[1]} start                                        # Start the agent with logging`,
  );
  console.log(
    `  ${process.argv[1]} stop                                         # Stop the running agent`,
  );
  console.log(
    `  ${process.argv[1]} status                                       # Check agent status`,
  );
  console.log(
    `  ${process.argv[1]} logs                                         # Show agent logs`,
  );
  console.log(
    `  ${process.argv[1]} send <network> <target_address> "<message>"  # Send a test message to an agent`,
  );
  console.log(
    `  ${process.argv[1]} help                                         # Show this help message`,
  );
}

// Start agent function
async function startAgent(): Promise<boolean> {
  // Check if agent is already running
  if (existsSync(PID_FILE)) {
    try {
      const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());
      process.kill(pid, 0); // This will throw an error if the process doesn't exist
      console.log(`Agent is already running with PID ${pid}`);
      return false;
    } catch (error) {
      // PID file exists but process is not running
    }
  }

  console.log(`Starting agent in ${AGENT_DIR}`);
  console.log(`Logs will be saved to ${LOG_FILE}`);

  // Start the agent with output redirected to log file
  const agent = spawn("yarn", ["dev"], {
    cwd: AGENT_DIR,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Save PID
  writeFileSync(PID_FILE, agent.pid?.toString() || "");

  // Verify it started
  if (agent.pid) {
    const logStream = require("fs").createWriteStream(LOG_FILE, { flags: "a" });
    agent.stdout.pipe(logStream);
    agent.stderr.pipe(logStream);

    console.log(`Agent started successfully with PID ${agent.pid}`);
    console.log("Waiting for agent initialization...");

    // Unref child to make parent process exit independently
    agent.unref();

    // Wait for initialization or timeout after 15 seconds
    let initialized = false;
    for (let i = 0; i < 15; i++) {
      await wait(1000);
      try {
        const logContent = readFileSync(LOG_FILE, "utf-8");
        if (
          logContent.includes("Waiting for messages") ||
          logContent.includes("Agent Details")
        ) {
          console.log("Agent initialized successfully!");
          console.log("Agent address and details:");
          // Extract agent details from log
          const detailsMatch = logContent.match(
            /Agent Details([\s\S]*?)(?=\n\n|\n$|$)/,
          );
          if (detailsMatch && detailsMatch[1]) {
            console.log(detailsMatch[1]);
          }
          initialized = true;
          break;
        }
      } catch (error) {
        // Continue waiting
      }
    }

    if (!initialized) {
      console.log(
        "Agent started but initialization not confirmed. Check logs for details.",
      );
    }

    return true;
  } else {
    console.log("Failed to start agent. Check for errors.");
    return false;
  }
}

// Stop agent function
async function stopAgent(): Promise<boolean> {
  if (!existsSync(PID_FILE)) {
    console.log("No PID file found, agent may not be running");
    return false;
  }

  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());

  try {
    process.kill(pid, 0); // Check if process exists
    console.log(`Stopping agent with PID ${pid}`);
    process.kill(pid);

    // Wait for process to terminate
    for (let i = 0; i < 5; i++) {
      await wait(1000);
      try {
        process.kill(pid, 0); // This will throw an error if the process doesn't exist
      } catch (error) {
        console.log("Agent stopped");
        // Remove PID file
        require("fs").unlinkSync(PID_FILE);
        return true;
      }
      console.log("Waiting for agent to terminate...");
    }

    // Force termination
    console.log("Agent did not terminate gracefully, forcing termination");
    process.kill(pid, "SIGKILL");

    // Remove PID file
    require("fs").unlinkSync(PID_FILE);
    console.log("Agent stopped");
    return true;
  } catch (error) {
    console.log(`No running agent found with PID ${pid}`);
    // Remove PID file
    require("fs").unlinkSync(PID_FILE);
    return false;
  }
}

// Check agent status
async function checkStatus(): Promise<boolean> {
  if (!existsSync(PID_FILE)) {
    console.log("No PID file found, agent is not running");
    return false;
  }

  const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());

  try {
    process.kill(pid, 0); // Check if process exists

    console.log(`Agent is running with PID ${pid}`);

    // Get log file size
    const { execSync } = require("child_process");
    const logSize = execSync(`du -h "${LOG_FILE}" | cut -f1`, {
      encoding: "utf-8",
    }).trim();
    console.log(`Log file: ${LOG_FILE} (${logSize} used)`);

    // Show process details
    console.log("Process details:");
    exec(
      `ps -p ${pid} -o pid,ppid,user,%cpu,%mem,vsz,rss,tty,stat,start,time,command`,
      (error, stdout) => {
        if (!error) {
          console.log(stdout);
        }
      },
    );

    // Show recent log entries
    console.log("Recent log entries:");
    exec(`tail -5 "${LOG_FILE}"`, (error, stdout) => {
      if (!error) {
        console.log(stdout);
      }
    });

    return true;
  } catch (error) {
    console.log(`PID file exists but agent is not running (PID ${pid})`);

    if (existsSync(LOG_FILE)) {
      const { execSync } = require("child_process");
      const logSize = execSync(`du -h "${LOG_FILE}" | cut -f1`, {
        encoding: "utf-8",
      }).trim();
      console.log(`Log file: ${LOG_FILE} (${logSize} used)`);
    }

    return false;
  }
}

// Show logs
function showLogs(): boolean {
  if (!existsSync(LOG_FILE)) {
    console.log(`No log file found at ${LOG_FILE}`);
    return false;
  }

  console.log(`Showing log file: ${LOG_FILE}`);
  console.log("Press Ctrl+C to exit");

  const tail = spawn("tail", ["-f", LOG_FILE], { stdio: "inherit" });

  // Handle process exit
  process.on("SIGINT", () => {
    tail.kill();
    process.exit();
  });

  return true;
}

// Send test message function
async function sendTestMessage(args: string[]): Promise<boolean> {
  const network = args[3];
  const targetAddress = args[4];
  const message = args[5];

  if (!network || !targetAddress || !message) {
    console.error("Error: Missing required parameters");
    console.error(
      `Usage: ${process.argv[1]} send <network> <target_address> "<message>"`,
    );
    return false;
  }

  console.log(`Network: ${network}`);
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
      env: network as XmtpEnv,
    });

    const identifier = await signer.getIdentifier();
    console.log(`Address: ${identifier.identifier}`);
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
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error sending message:", errorMessage);
    return false;
  }
}

// Main function
async function main(): Promise<void> {
  const command = process.argv[2] || "help";

  switch (command) {
    case "start":
      await startAgent();
      break;
    case "stop":
      await stopAgent();
      break;
    case "status":
      await checkStatus();
      break;
    case "logs":
      showLogs();
      break;
    case "send":
      await sendTestMessage(process.argv);
      break;
    case "help":
    case "--help":
    case "-h":
      showUsage();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      showUsage();
      process.exit(1);
  }
}

// Run the main function
main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(errorMessage);
  process.exit(1);
});
