import fs from "fs";

export function getDbPath(description: string = "xmtp") {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}

// Simple dbPath callback using inboxId + env as identifier
export const dbPathCallback = (inboxId: string) =>
  getDbPath(inboxId.slice(0, 8));
