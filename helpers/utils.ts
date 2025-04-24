import type { Client } from "@xmtp/node-sdk";
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

export const logAgentDetails = (client: Client) => {
  const address = client.accountIdentifier?.identifier ?? "";
  const inboxId = client.inboxId;
  const env = client.options?.env ?? "dev";
  const createLine = (length: number, char = "═"): string =>
    char.repeat(length - 2);
  const centerText = (text: string, width: number): string => {
    const padding = Math.max(0, width - text.length);
    const leftPadding = Math.floor(padding / 2);
    return " ".repeat(leftPadding) + text + " ".repeat(padding - leftPadding);
  };

  console.log(`\x1b[38;2;252;76;52m
    ██╗  ██╗███╗   ███╗████████╗██████╗ 
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ 
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     
  \x1b[0m`);

  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  const maxLength = Math.max(url.length + 12, address.length + 15, 30);

  // Get the current folder name from the process working directory
  const currentFolder = process.cwd().split("/").pop() || "";
  const dbPath = `../${currentFolder}/xmtp-${env}-${address}.db3`;
  const maxLengthWithDbPath = Math.max(maxLength, dbPath.length + 15);

  const box = [
    `╔${createLine(maxLengthWithDbPath)}╗`,
    `║   ${centerText("Agent Details", maxLengthWithDbPath - 6)} ║`,
    `╟${createLine(maxLengthWithDbPath, "─")}╢`,
    `║ 📍 Address: ${address}${" ".repeat(maxLengthWithDbPath - address.length - 15)}║`,
    `║ 📍 inboxId: ${inboxId}${" ".repeat(maxLengthWithDbPath - inboxId.length - 15)}║`,
    `║ 📂 DB Path: ${dbPath}${" ".repeat(maxLengthWithDbPath - dbPath.length - 15)}║`,
    `║ 🛜  Network: ${env}${" ".repeat(maxLengthWithDbPath - env.length - 15)}║`,
    `║ 🔗 URL: ${url}${" ".repeat(maxLengthWithDbPath - url.length - 11)}║`,
    `╚${createLine(maxLengthWithDbPath)}╝`,
  ].join("\n");

  console.log(box);
};

export function validateEnvironment(vars: string[]): Record<string, string> {
  const requiredVars = vars;
  const missing = requiredVars.filter((v) => !process.env[v]);

  // If there are missing vars, try to load them from the root .env file
  if (missing.length) {
    console.log(
      `Missing env vars: ${missing.join(", ")}. Trying root .env file...`,
    );

    // Find the root directory by going up from the current example directory
    const currentDir = process.cwd();
    const rootDir = path.resolve(currentDir, "../..");
    const rootEnvPath = path.join(rootDir, ".env");

    if (fs.existsSync(rootEnvPath)) {
      // Load the root .env file content
      const envContent = fs.readFileSync(rootEnvPath, "utf-8");

      // Parse the .env file content
      const envVars = envContent
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"))
        .reduce<Record<string, string>>((acc, line) => {
          const [key, ...valueParts] = line.split("=");
          if (key && valueParts.length) {
            acc[key.trim()] = valueParts.join("=").trim();
          }
          return acc;
        }, {});

      // Set the missing environment variables
      for (const varName of missing) {
        if (envVars[varName]) {
          process.env[varName] = envVars[varName];
          console.log(`Loaded ${varName} from root .env file`);
        }
      }
    } else {
      console.log("Root .env file not found.");
    }
  }

  // Check again if there are still missing variables
  const stillMissing = requiredVars.filter((v) => !process.env[v]);
  if (stillMissing.length) {
    console.error(
      "Missing env vars after checking root .env:",
      stillMissing.join(", "),
    );
    process.exit(1);
  }

  return requiredVars.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] as string;
    return acc;
  }, {});
}
