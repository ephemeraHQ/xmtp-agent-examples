import "dotenv/config";

export const logAgentDetails = (
  address: string,
  inboxId: string,
  env: string,
) => {
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

  if (missing.length) {
    console.error("Missing env vars:", missing.join(", "));
    process.exit(1);
  }

  return requiredVars.reduce<Record<string, string>>((acc, key) => {
    acc[key] = process.env[key] as string;
    return acc;
  }, {});
}
