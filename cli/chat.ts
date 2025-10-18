import "dotenv/config";
import * as readline from "readline";
import {
  APP_VERSION,
  createSigner,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import {
  getActiveVersion,
  IdentifierKind,
  type Client,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
} from "@versions/node-sdk";

// ANSI color codes for pretty terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
};

class XmtpChatCLI {
  private client: Client | null = null;
  private currentConversation: Conversation | null = null;
  private rl: readline.Interface | null = null;
  private messageStream: any = null;
  private isStreaming = false;

  constructor(public env: XmtpEnv = "production") {}

  // Initialize XMTP client
  async initializeClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    const walletKey = process.env.WALLET_KEY;
    const encryptionKey = process.env.ENCRYPTION_KEY;

    if (!walletKey || !encryptionKey) {
      throw new Error(
        "WALLET_KEY and ENCRYPTION_KEY must be set in environment",
      );
    }

    const signer = createSigner(walletKey as `0x${string}`);
    const dbEncryptionKey = getEncryptionKeyFromHex(encryptionKey);

    console.log(
      `${colors.cyan}${colors.bright}Initializing XMTP client...${colors.reset}`,
    );

    // @ts-expect-error - TODO: fix this
    this.client = await getActiveVersion().Client.create(signer, {
      dbEncryptionKey,
      env: this.env,
      appVersion: APP_VERSION,
    });

    // Get address info
    const identifier = await signer.getIdentifier();
    const address =
      identifier.identifierKind === IdentifierKind.Ethereum
        ? identifier.identifier
        : "Unknown";

    console.log(
      `${colors.green}✓ Connected to XMTP ${this.env}${colors.reset}`,
    );
    console.log(`${colors.dim}Inbox ID: ${this.client.inboxId}${colors.reset}`);
    console.log(`${colors.dim}Address: ${address}${colors.reset}\n`);

    return this.client as Client;
  }

  // List all conversations and let user select one
  async selectConversation(): Promise<Conversation | null> {
    const client = await this.initializeClient();

    console.log(
      `${colors.yellow}${colors.bright}Syncing conversations...${colors.reset}`,
    );
    await client.conversations.sync();

    const conversations = await client.conversations.list();

    if (conversations.length === 0) {
      console.log(
        `${colors.red}No conversations found. Start a conversation on XMTP first!${colors.reset}`,
      );
      return null;
    }

    console.log(
      `\n${colors.cyan}${colors.bright}═══════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}         YOUR CONVERSATIONS${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}═══════════════════════════════════════${colors.reset}\n`,
    );

    // Display conversations with numbers
    for (let i = 0; i < conversations.length; i++) {
      const conv = conversations[i];
      const isGroup = conv.constructor.name === "Group";

      if (isGroup) {
        const group = conv as any;
        const members = await conv.members();
        console.log(
          `${colors.bright}${i + 1}.${colors.reset} ${colors.green}[GROUP]${colors.reset} ${group.name || "Unnamed Group"}`,
        );
        console.log(
          `   ${colors.dim}${members.length} members • ID: ${conv.id.slice(0, 12)}...${colors.reset}`,
        );
      } else {
        const dm = conv as any;
        console.log(
          `${colors.bright}${i + 1}.${colors.reset} ${colors.blue}[DM]${colors.reset} ${dm.peerInboxId.slice(0, 16)}...`,
        );
        console.log(
          `   ${colors.dim}ID: ${conv.id.slice(0, 12)}...${colors.reset}`,
        );
      }
      console.log("");
    }

    // Get user selection
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const selection = await new Promise<string>((resolve) => {
      rl.question(
        `${colors.yellow}Select a conversation (1-${conversations.length}) or 'q' to quit: ${colors.reset}`,
        (answer) => {
          rl.close();
          resolve(answer.trim());
        },
      );
    });

    if (selection.toLowerCase() === "q") {
      return null;
    }

    const index = parseInt(selection) - 1;
    if (isNaN(index) || index < 0 || index >= conversations.length) {
      console.log(`${colors.red}Invalid selection!${colors.reset}`);
      return null;
    }

    return conversations[index];
  }

  // Format and display a message
  private displayMessage(message: DecodedMessage, isFromSelf: boolean): void {
    const timestamp = message.sentAt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const senderShort = message.senderInboxId.slice(0, 8);
    const sender = isFromSelf
      ? `${colors.green}You${colors.reset}`
      : `${colors.cyan}${senderShort}${colors.reset}`;

    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ${sender}: ${content}`,
    );
  }

  // Start streaming messages from the conversation
  private async startMessageStream(conversation: Conversation): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    this.isStreaming = true;
    const client = await this.initializeClient();

    try {
      // Stream messages
      this.messageStream = await conversation.streamMessages((message) => {
        const isFromSelf = message.senderInboxId === client.inboxId;

        // Clear the current line and move cursor up to avoid interfering with prompt
        process.stdout.write("\r\x1b[K");

        this.displayMessage(message, isFromSelf);

        // Redisplay the prompt
        if (this.rl) {
          (this.rl as any).prompt(true);
        }
      });
    } catch (error) {
      console.error(
        `${colors.red}Error streaming messages:${colors.reset}`,
        error,
      );
      this.isStreaming = false;
    }
  }

  // Stop message stream
  private async stopMessageStream(): Promise<void> {
    if (this.messageStream) {
      await this.messageStream.stop();
      this.messageStream = null;
    }
    this.isStreaming = false;
  }

  // Display conversation header
  private displayConversationHeader(conversation: Conversation): void {
    const isGroup = conversation.constructor.name === "Group";

    console.clear();
    console.log(
      `${colors.magenta}${colors.bright}═══════════════════════════════════════${colors.reset}`,
    );

    if (isGroup) {
      const group = conversation as any;
      console.log(
        `${colors.magenta}${colors.bright}  GROUP: ${group.name || "Unnamed Group"}${colors.reset}`,
      );
      if (group.description) {
        console.log(`${colors.dim}  ${group.description}${colors.reset}`);
      }
    } else {
      const dm = conversation as any;
      console.log(
        `${colors.magenta}${colors.bright}  DM with: ${dm.peerInboxId}${colors.reset}`,
      );
    }

    console.log(
      `${colors.magenta}${colors.bright}═══════════════════════════════════════${colors.reset}\n`,
    );
    console.log(
      `${colors.dim}Commands: /back (return to list) • /exit (quit)${colors.reset}\n`,
    );
  }

  // Chat in the selected conversation
  async chatInConversation(conversation: Conversation): Promise<boolean> {
    this.currentConversation = conversation;
    const client = await this.initializeClient();

    // Display header
    this.displayConversationHeader(conversation);

    // Load and display recent messages
    console.log(`${colors.yellow}Loading recent messages...${colors.reset}\n`);
    await conversation.sync();
    const messages = await conversation.messages();

    // Display last 20 messages
    const recentMessages = messages.slice(-20);
    for (const message of recentMessages) {
      const isFromSelf = message.senderInboxId === client.inboxId;
      this.displayMessage(message, isFromSelf);
    }

    if (messages.length > 20) {
      console.log(
        `${colors.dim}... and ${messages.length - 20} earlier messages${colors.reset}`,
      );
    }
    console.log("");

    // Start streaming new messages
    await this.startMessageStream(conversation);

    // Setup readline for input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.green}You${colors.reset} > `,
    });

    this.rl.prompt();

    return new Promise<boolean>((resolve) => {
      this.rl!.on("line", async (input) => {
        const message = input.trim();

        if (!message) {
          this.rl!.prompt();
          return;
        }

        // Handle commands
        if (message === "/back") {
          await this.stopMessageStream();
          this.rl!.close();
          resolve(true); // Return to conversation list
          return;
        }

        if (message === "/exit") {
          await this.stopMessageStream();
          this.rl!.close();
          resolve(false); // Exit app
          return;
        }

        // Send message
        try {
          await conversation.send(message);
          // Message will appear via stream
        } catch (error) {
          console.error(
            `${colors.red}Failed to send message:${colors.reset}`,
            error,
          );
        }

        this.rl!.prompt();
      });

      this.rl!.on("close", async () => {
        await this.stopMessageStream();
        resolve(false);
      });
    });
  }

  // Main chat loop
  async start(): Promise<void> {
    try {
      await this.initializeClient();

      let keepRunning = true;

      while (keepRunning) {
        const conversation = await this.selectConversation();

        if (!conversation) {
          console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
          break;
        }

        keepRunning = await this.chatInConversation(conversation);
      }
    } catch (error) {
      console.error(`${colors.red}Error:${colors.reset}`, error);
    } finally {
      await this.stopMessageStream();
      process.exit(0);
    }
  }
}

// Parse command line arguments
function parseArgs(): { env: XmtpEnv; help: boolean } {
  const args = process.argv.slice(2);
  let env = (process.env.XMTP_ENV as XmtpEnv) || "production";
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--env" && nextArg) {
      env = nextArg as XmtpEnv;
      i++;
    }
  }

  return { env, help };
}

function showHelp(): void {
  console.log(`
${colors.cyan}${colors.bright}XMTP CLI Chat Interface${colors.reset}

Chat with your XMTP conversations directly from the terminal.

${colors.bright}USAGE:${colors.reset}
  yarn chat [options]

${colors.bright}OPTIONS:${colors.reset}
  --env <environment>    XMTP environment (local, dev, production)
                        [default: production or XMTP_ENV]
  -h, --help            Show this help message

${colors.bright}EXAMPLES:${colors.reset}
  yarn chat
  yarn chat --env dev
  yarn chat --env local

${colors.bright}ENVIRONMENT VARIABLES:${colors.reset}
  XMTP_ENV          Default environment
  WALLET_KEY        Wallet private key (required)
  ENCRYPTION_KEY    Database encryption key (required)
`);
}

// CLI entry point
async function main(): Promise<void> {
  const { env, help } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  console.clear();
  console.log(
    `${colors.cyan}${colors.bright}
╔═══════════════════════════════════════╗
║       XMTP CLI Chat Interface         ║
╚═══════════════════════════════════════╝
${colors.reset}`,
  );

  const chat = new XmtpChatCLI(env);

  await chat.start();
}

void main();
