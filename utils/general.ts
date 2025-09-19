import fs, { existsSync } from "fs";

export function getDbPath(description: string = "xmtp") {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${process.env.XMTP_ENV}-${description}.db3`;
}

export function loadEnvFile() {
  const filePath = ".env";
  if (existsSync(filePath)) {
    process.loadEnvFile(filePath);
  } else if (existsSync(`../../${filePath}`)) {
    process.loadEnvFile(`../../${filePath}`);
  }
}
