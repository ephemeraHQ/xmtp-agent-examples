#!/usr/bin/env tsx
/**
 * XMTP Parallel Agent Manager Script
 * This TypeScript script handles running, logging, and managing multiple XMTP agents in parallel
 */
import { execSync, spawn } from "child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client, IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";

// Default keys for testing - you should replace these with your own in production
const DEFAULT_WALLET_KEY =
  "0x11567776b95bdbed513330f503741e19877bf7fe73e7957bf6f0ecf3e267fdb8";
const DEFAULT_ENCRYPTION_KEY =
  "11973168e34839f9d31749ad77204359c5c39c404e1154eacb7f35a867ee47de";

// Type definitions for parallel agent records
interface AgentRecord {
  pid: number;
  logFile: string;
  startTime: string;
}

// Set working directory to the current directory
const AGENT_DIR = process.cwd();
// Get project root directory (2 levels up from scripts folder)
const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TMP_DIR = join(PROJECT_ROOT, ".tmp");
const AGENT_NAME = AGENT_DIR.split("/").pop() || "default-agent";
const TMP_AGENT_DIR = join(TMP_DIR, AGENT_NAME);
const PARALLEL_LOGS_DIR = join(TMP_AGENT_DIR, "parallel-logs");
const PARALLEL_PIDS_FILE = join(TMP_AGENT_DIR, "agents.json");

// Create tmp directories if they don't exist
if (!existsSync(TMP_DIR)) {
  mkdirSync(TMP_DIR, { recursive: true });
}
if (!existsSync(TMP_AGENT_DIR)) {
  mkdirSync(TMP_AGENT_DIR, { recursive: true });
}
if (!existsSync(PARALLEL_LOGS_DIR)) {
  mkdirSync(PARALLEL_LOGS_DIR, { recursive: true });
}

// Function to wait for specified milliseconds
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Show usage function
function showUsage(): void {
  console.log("XMTP Parallel Agent Manager");
  console.log("Usage:");
  console.log(
    `  ${process.argv[1]} start <count>        # Start multiple agent instances (default: 2)`,
  );
  console.log(
    `  ${process.argv[1]} stop                 # Stop all agent instances`,
  );
  console.log(
    `  ${process.argv[1]} status               # Check status of all agents`,
  );
  console.log(
    `  ${process.argv[1]} logs <instanceId>    # Show logs for a specific agent`,
  );
  console.log(
    `  ${process.argv[1]} send <network> <target_address> "<message>"  # Send a test message`,
  );
  console.log(
    `  ${process.argv[1]} help                 # Show this help message`,
  );
}

// Show logs for a specific agent
function showLogs(instanceId: string): boolean {
  if (!existsSync(PARALLEL_PIDS_FILE)) {
    console.log("No agents found");
    return false;
  }

  try {
    const agentRecords = JSON.parse(
      readFileSync(PARALLEL_PIDS_FILE, "utf-8"),
    ) as Record<string, AgentRecord>;

    if (!Object.prototype.hasOwnProperty.call(agentRecords, instanceId)) {
      console.log(`No agent found with ID: ${instanceId}`);
      console.log(`Available agents: ${Object.keys(agentRecords).join(", ")}`);
      return false;
    }

    const logFile = agentRecords[instanceId].logFile;
    if (!existsSync(logFile)) {
      console.log(`No log file found at ${logFile}`);
      return false;
    }

    console.log(`Showing log file for ${instanceId}: ${logFile}`);
    console.log("Press Ctrl+C to exit");

    // Use execSync to display logs but not trap the process
    execSync(`tail -n 20 "${logFile}"`, { stdio: "inherit" });

    return true;
  } catch (error) {
    console.error("Error displaying logs:", error);
    return false;
  }
}

// Start multiple agents in parallel
async function startAgents(count: number): Promise<boolean> {
  // Validate count
  if (isNaN(count) || count < 1 || count > 10) {
    console.error("Error: Invalid instance count. Must be between 1 and 10.");
    return false;
  }

  console.log(`Starting ${count} agent instances in ${AGENT_DIR}`);

  // Load existing agents if any
  let existingAgents: Record<string, AgentRecord> = {};
  if (existsSync(PARALLEL_PIDS_FILE)) {
    try {
      const parsedAgents = JSON.parse(
        readFileSync(PARALLEL_PIDS_FILE, "utf-8"),
      ) as Record<string, AgentRecord>;
      existingAgents = parsedAgents;

      // Check if any agents are already running
      let runningCount = 0;
      for (const [id, record] of Object.entries(existingAgents)) {
        try {
          process.kill(record.pid, 0); // Check if process exists
          runningCount++;
        } catch {
          // Process not running
          // Use Reflect.deleteProperty instead of delete
          Reflect.deleteProperty(existingAgents, id);
        }
      }

      if (runningCount > 0) {
        console.log(`${runningCount} agents are already running`);
      }
    } catch (error) {
      console.log("No valid existing agents found", error);
      existingAgents = {};
    }
  }

  // Create a record to store all agent PIDs and details
  const agentRecords = { ...existingAgents };
  const existingCount = Object.keys(agentRecords).length;
  const newCount = count - existingCount;

  if (newCount <= 0) {
    console.log(
      `Already running ${existingCount} agents, which is >= ${count}`,
    );
    return true;
  }

  console.log(`Starting ${newCount} new agent instances...`);

  // Start new agents in parallel
  const startPromises = Array.from({ length: newCount }, (_, index) => {
    const instanceNumber = existingCount + index + 1;
    const instanceId = `agent-${instanceNumber}`;
    const logFile = join(PARALLEL_LOGS_DIR, `${instanceId}.log`);

    console.log(`Starting ${instanceId}...`);
    console.log(`Logs will be saved to ${logFile}`);

    // Add a unique environment for each instance
    const uniqueEnv = {
      ...process.env,
      // Generate unique keys for each instance to avoid conflicts
      WALLET_KEY: undefined, // Force to use generated keys
      ENCRYPTION_KEY: undefined,
      AGENT_INSTANCE_ID: instanceId,
    };

    // Start the agent process
    const agent = spawn("yarn", ["dev"], {
      cwd: AGENT_DIR,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: uniqueEnv,
    });

    if (!agent.pid) {
      console.error(`Failed to start ${instanceId}`);
      return false;
    }

    // Setup logging
    const logStream = createWriteStream(logFile, { flags: "a" });

    // Write header to log file
    const logHeader = `\n========== ${instanceId} started at ${new Date().toISOString()} ==========\n`;
    logStream.write(logHeader);

    // Force output encoding to utf8 before piping
    agent.stdout.setEncoding("utf8");
    agent.stdout.pipe(logStream);

    // Also log to console for debugging
    agent.stdout.on("data", (data: Buffer | string) => {
      const message =
        typeof data === "string" ? data.trim() : data.toString("utf8").trim();
      if (message) {
        console.log(`[${instanceId}] ${message}`);
      }
    });

    agent.stderr.setEncoding("utf8");
    agent.stderr.pipe(logStream);

    // Also log to console for debugging
    agent.stderr.on("data", (data: Buffer | string) => {
      const message =
        typeof data === "string" ? data.trim() : data.toString("utf8").trim();
      if (message) {
        console.error(`[${instanceId}] ERROR: ${message}`);
      }
    });

    // Handle process exit
    agent.on("exit", (code) => {
      const exitMessage = `\n========== ${instanceId} exited with code ${code} at ${new Date().toISOString()} ==========\n`;
      logStream.write(exitMessage);
      logStream.end();
      console.log(`[${instanceId}] Process exited with code ${code}`);
    });

    // Unref to let parent process exit independently
    agent.unref();

    // Add to the agents record
    agentRecords[instanceId] = {
      pid: agent.pid,
      logFile,
      startTime: new Date().toISOString(),
    };

    console.log(`${instanceId} started with PID ${agent.pid}`);
    return true;
  });

  // Wait for all agents to start
  const results = await Promise.all(startPromises);
  const allSucceeded = results.every(Boolean);

  // Save the agent records
  writeFileSync(PARALLEL_PIDS_FILE, JSON.stringify(agentRecords, null, 2));

  if (allSucceeded) {
    console.log(`Successfully started ${newCount} new agent instances`);
    console.log(`Total running agents: ${Object.keys(agentRecords).length}`);
    console.log(`Agent details saved to ${PARALLEL_PIDS_FILE}`);
  } else {
    console.error("Failed to start some agent instances");
  }

  return allSucceeded;
}

// Stop all agents
async function stopAgents(): Promise<boolean> {
  if (!existsSync(PARALLEL_PIDS_FILE)) {
    console.log("No agents found");
    return false;
  }

  try {
    const agentRecords = JSON.parse(
      readFileSync(PARALLEL_PIDS_FILE, "utf-8"),
    ) as Record<string, AgentRecord>;
    const instanceIds = Object.keys(agentRecords);

    if (instanceIds.length === 0) {
      console.log("No agents found in records");
      return false;
    }

    console.log(`Stopping ${instanceIds.length} agent instances...`);

    let successCount = 0;
    for (const instanceId of instanceIds) {
      const record = agentRecords[instanceId];

      try {
        // Ensure we have a valid pid
        if (typeof record.pid !== "number") {
          console.log(`Invalid PID for ${instanceId}`);
          continue;
        }

        process.kill(record.pid, 0); // Check if process exists
        console.log(`Stopping ${instanceId} with PID ${record.pid}`);
        process.kill(record.pid);

        // Wait briefly for process to terminate
        await wait(500);
        successCount++;
      } catch {
        console.log(`Process for ${instanceId} (PID ${record.pid}) not found`);
      }
    }

    // Remove the agents file
    unlinkSync(PARALLEL_PIDS_FILE);
    console.log(
      `Stopped ${successCount} of ${instanceIds.length} agent instances`,
    );

    return successCount > 0;
  } catch (error) {
    console.error("Error stopping agents:", error);
    return false;
  }
}

// Check status of all agents
function checkStatus(): boolean {
  if (!existsSync(PARALLEL_PIDS_FILE)) {
    console.log("No agents found");
    return false;
  }

  try {
    const agentRecords = JSON.parse(
      readFileSync(PARALLEL_PIDS_FILE, "utf-8"),
    ) as Record<string, AgentRecord>;
    const instanceIds = Object.keys(agentRecords);

    if (instanceIds.length === 0) {
      console.log("No agents found in records");
      return false;
    }

    console.log(`Found ${instanceIds.length} agent instances:`);

    let runningCount = 0;
    for (const instanceId of instanceIds) {
      const record = agentRecords[instanceId];

      try {
        process.kill(record.pid, 0); // Check if process exists
        console.log(
          `- ${instanceId}: Running with PID ${record.pid}, started at ${record.startTime}`,
        );

        // Get log file size
        const logSize = execSync(`du -h "${record.logFile}" | cut -f1`, {
          encoding: "utf-8",
        }).trim();
        console.log(`  Log: ${record.logFile} (${logSize} used)`);

        // Show recent log entries
        console.log(`  Recent log entries:`);
        const logs = execSync(`tail -3 "${record.logFile}"`, {
          encoding: "utf-8",
        }).trim();
        logs.split("\n").forEach((line) => {
          console.log(`    ${line}`);
        });

        runningCount++;
      } catch {
        console.log(`- ${instanceId}: Not running (PID ${record.pid})`);
      }
      console.log();
    }

    console.log(
      `${runningCount} of ${instanceIds.length} agents are currently running`,
    );
    return runningCount > 0;
  } catch (error) {
    console.error("Error checking agents status:", error);
    return false;
  }
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
    case "start": {
      const count = parseInt(process.argv[3] || "2");
      const started = await startAgents(count);
      process.exit(started ? 0 : 1);
      break;
    }
    case "stop":
      await stopAgents();
      break;
    case "status":
      checkStatus();
      break;
    case "logs": {
      const instanceId = process.argv[3];
      if (!instanceId) {
        console.error("Error: Instance ID required");
        console.error(`Usage: ${process.argv[1]} logs <instanceId>`);
        process.exit(1);
      }
      showLogs(instanceId);
      break;
    }
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
