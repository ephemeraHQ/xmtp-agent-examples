import { existsSync } from "fs";

export function loadEnvFile() {
  // Ionly do this in the gm example because it's call from the root
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  } else if (existsSync(`../../.env`)) {
    process.loadEnvFile(`../../.env`);
  }
}
