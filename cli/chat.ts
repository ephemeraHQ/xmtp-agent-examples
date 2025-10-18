import "dotenv/config";
import * as readline from "readline";
import {
  Agent,
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
  type Group,
  type Dm,
} from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { fromString } from "uint8arrays/from-string";

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
  bgCyan: "\x1b[46m",
  bgBlue: "\x1b[44m",
  bgGray: "\x1b[100m",
};

// Terminal UI Manager for fixed input field layout
class TerminalUI {
  private messageBuffer: string[] = [];
  private maxMessages = 100;
  private terminalHeight: number;
  private inputHeight = 3; // Lines reserved for input area
  private headerHeight = 3; // Lines for header

  constructor() {
    this.terminalHeight = process.stdout.rows || 24;
    process.stdout.on("resize", () => {
      this.terminalHeight = process.stdout.rows || 24;
    });
  }

  get messageAreaHeight(): number {
    return this.terminalHeight - this.inputHeight - this.headerHeight - 1;
  }

  // Add a message to the buffer
  addMessage(message: string): void {
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > this.maxMessages) {
      this.messageBuffer.shift();
    }
  }

  // Render the header
  renderHeader(conversation: Conversation): string {
    const isGroup = conversation.constructor.name === "Group";
    let header = "";

    if (isGroup) {
      const group = conversation as Group;
      header = `${colors.bgCyan}${colors.bright} GROUP: ${group.name || "Unnamed Group"} ${colors.reset}`;
    } else {
      const dm = conversation as Dm;
      const peerId = dm.peerInboxId.slice(0, 16) + "...";
      header = `${colors.bgBlue}${colors.bright} DM: ${peerId} ${colors.reset}`;
    }

    return header;
  }

  // Render the input separator with box styling
  renderInputArea(): void {
    const width = process.stdout.columns || 80;
    const separator = `${colors.dim}${"─".repeat(width)}${colors.reset}`;
    console.log(separator);
  }

  // Clear screen and render full UI
  render(conversation: Conversation, prompt: string): void {
    // Clear screen and move cursor to top
    process.stdout.write("\x1b[2J\x1b[H");

    // Render header
    console.log(this.renderHeader(conversation));
    console.log(
      `${colors.dim}Commands: /conversations • /back • /exit${colors.reset}\n`,
    );

    // Render messages (last N messages that fit)
    const visibleMessages = this.messageBuffer.slice(-this.messageAreaHeight);
    for (const message of visibleMessages) {
      console.log(message);
    }

    // Move to bottom for input area
    const currentLine = this.headerHeight + visibleMessages.length + 1;
    const targetLine = this.terminalHeight - this.inputHeight;
    if (currentLine < targetLine) {
      process.stdout.write("\n".repeat(targetLine - currentLine));
    }

    // Render input separator
    this.renderInputArea();

    // Input prompt (readline will handle this line)
    process.stdout.write(prompt);
  }

  // Add message and refresh display (for new messages during chat)
  addAndRefresh(
    message: string,
    conversation: Conversation,
    rl: readline.Interface,
  ): void {
    this.addMessage(message);

    // Save cursor position and current line
    const rlWithLine = rl as readline.Interface & {
      line?: string;
      cursor?: number;
    };
    const currentInput = rlWithLine.line || "";

    // Re-render everything
    this.render(conversation, "");

    // Restore readline's input
    if (currentInput) {
      rlWithLine.line = currentInput;
      rlWithLine.cursor = currentInput.length;
    }

    // Refresh readline display
    const rlInterface = rl as readline.Interface & {
      _refreshLine?: () => void;
    };
    if (rlInterface._refreshLine) {
      rlInterface._refreshLine();
    }
  }

  // Clear the screen completely
  clear(): void {
    process.stdout.write("\x1b[2J\x1b[H");
  }
}

class XmtpChatCLI {
  private agent: Agent | null = null;
  private currentConversation: Conversation | null = null;
  private rl: readline.Interface | null = null;
  private messageStream: AsyncIterable<DecodedMessage> | null = null;
  private isStreaming = false;
  private terminalUI: TerminalUI | null = null;
  private conversationsList: Conversation[] = [];

  constructor(public env: XmtpEnv = "production") {}

  // Initialize XMTP agent
  async initializeAgent(): Promise<Agent> {
    if (this.agent) {
      return this.agent;
    }

    const walletKey = process.env.XMTP_CLIENT_WALLET_KEY;
    const encryptionKey = process.env.XMTP_CLIENT_DB_ENCRYPTION_KEY;
    if (!walletKey || !encryptionKey) {
      throw new Error(
        "XMTP_CLIENT_WALLET_KEY and XMTP_CLIENT_DB_ENCRYPTION_KEY must be set in environment",
      );
    }
    const user = createUser(walletKey as `0x${string}`);
    const signer = createSigner(user);
    const dbEncryptionKey = fromString(encryptionKey!, "hex");

    console.log(
      `${colors.cyan}${colors.bright}Initializing XMTP client...${colors.reset}`,
    );

    this.agent = await Agent.create(signer, {
      env: this.env,
      dbEncryptionKey,
    });

    // Get address info
    const identifier = await signer.getIdentifier();
    const address =
      identifier.identifierKind === IdentifierKind.Ethereum
        ? identifier.identifier
        : "Unknown";

    // Display detailed client information banner
    await this.displayClientBanner(address);

    return this.agent;
  }

  // Display client information banner
  async displayClientBanner(address: string): Promise<void> {
    if (!this.agent) return;

    const client = this.agent.client;

    const inboxId = client.inboxId;

    // Get conversations count
    await client.conversations.sync();
    const conversations = await client.conversations.list();

    // Get inbox state
    const inboxState = await client.preferences.inboxState();

    const url = `http://xmtp.chat/dm/${address}`;

    // Smaller logo lines
    const logoLines = [
      `\x1b[38;2;252;76;52m ██╗  ██╗███╗   ███╗`,
      ` ╚██╗██╔╝████╗ ████║`,
      `  ╚███╔╝ ██╔████╔██║`,
      `  ██╔██╗ ██║╚██╔╝██║`,
      ` ██╔╝ ██╗██║ ╚═╝ ██║`,
      ` ╚═╝  ╚═╝╚═╝     ╚═╝\x1b[0m`,
    ];

    // Details lines
    const detailsLines = [
      `${colors.green}${colors.bright}✓ XMTP Client Initialized${colors.reset}`,
      `${colors.dim}InboxId:${colors.reset} ${inboxId}`,
      `${colors.dim}Address:${colors.reset} ${address}`,
      `${colors.dim}Conversations:${colors.reset} ${conversations.length} • ${colors.dim}Installations:${colors.reset} ${inboxState.installations.length}`,
      `${colors.dim}Network:${colors.reset} ${this.env}`,
      `${colors.dim}URL:${colors.reset} ${colors.cyan}${url}${colors.reset}`,
    ];

    console.log("");
    // Print logo and details side by side
    for (let i = 0; i < Math.max(logoLines.length, detailsLines.length); i++) {
      const logo = logoLines[i] || " ".repeat(21);
      const detail = detailsLines[i] || "";
      console.log(`${logo}  ${detail}`);
    }
    console.log("");
  }

  // Find or create conversation with a specific agent (by address or inbox ID)
  async findOrCreateConversation(
    identifier: string,
  ): Promise<Conversation | null> {
    const agent = await this.initializeAgent();
    const client = agent.client;

    console.log(
      `${colors.yellow}${colors.bright}Looking for conversation with: ${identifier}${colors.reset}`,
    );

    // Sync conversations first
    await client.conversations.sync();
    const conversations = await client.conversations.list();

    // Determine if identifier is an Ethereum address or inbox ID
    const isEthAddress =
      identifier.startsWith("0x") && identifier.length === 42;

    // Try to find existing conversation
    for (const conv of conversations) {
      if (conv.constructor.name === "Dm") {
        const dm = conv as Dm;

        // Check if peer inbox ID matches
        if (dm.peerInboxId.toLowerCase() === identifier.toLowerCase()) {
          console.log(
            `${colors.green}✓ Found existing DM with agent${colors.reset}\n`,
          );
          return conv;
        }

        // If identifier is an Ethereum address, check member addresses
        if (isEthAddress) {
          const members = await conv.members();
          for (const member of members) {
            const ethIdentifier = member.accountIdentifiers.find(
              (id) => id.identifierKind === IdentifierKind.Ethereum,
            );
            if (
              ethIdentifier &&
              ethIdentifier.identifier.toLowerCase() ===
                identifier.toLowerCase()
            ) {
              console.log(
                `${colors.green}✓ Found existing DM with agent${colors.reset}\n`,
              );
              return conv;
            }
          }
        }
      }
    }

    // No existing conversation found, create new one
    console.log(
      `${colors.yellow}No existing conversation found. Creating new DM...${colors.reset}`,
    );

    try {
      let newConversation: Dm;

      if (isEthAddress) {
        // Create DM using Ethereum address
        newConversation = await client.conversations.newDmWithIdentifier({
          identifier,
          identifierKind: IdentifierKind.Ethereum,
        });
        console.log(
          `${colors.green}✓ Created new DM with agent${colors.reset}\n`,
        );
      } else {
        // Create DM using inbox ID
        newConversation = await client.conversations.newDm(identifier);
        console.log(
          `${colors.green}✓ Created new DM with agent${colors.reset}\n`,
        );
      }

      return newConversation;
    } catch (error) {
      console.error(
        `${colors.red}Failed to create conversation:${colors.reset}`,
        error,
      );
      return null;
    }
  }

  // Display conversations in chat UI
  private async displayConversationsInChat(): Promise<void> {
    if (!this.terminalUI || !this.currentConversation) return;

    const agent = await this.initializeAgent();
    const client = agent.client;

    await client.conversations.sync();
    this.conversationsList = await client.conversations.list();

    this.terminalUI.addMessage("");
    this.terminalUI.addMessage(
      `${colors.cyan}${colors.bright}═══ YOUR CONVERSATIONS ═══${colors.reset}`,
    );

    if (this.conversationsList.length === 0) {
      this.terminalUI.addMessage(
        `${colors.red}No conversations found${colors.reset}`,
      );
      return;
    }

    for (let i = 0; i < this.conversationsList.length; i++) {
      const conv = this.conversationsList[i];
      const isGroup = conv.constructor.name === "Group";
      const isCurrent = conv.id === this.currentConversation?.id;

      if (isGroup) {
        const group = conv as Group;
        const label = isCurrent ? `${colors.green}●${colors.reset}` : " ";
        this.terminalUI.addMessage(
          `${label} ${colors.bright}${i + 1}.${colors.reset} ${colors.green}[GROUP]${colors.reset} ${group.name || "Unnamed"}`,
        );
      } else {
        const dm = conv as Dm;
        const label = isCurrent ? `${colors.green}●${colors.reset}` : " ";
        const peerShort = dm.peerInboxId.slice(0, 16) + "...";
        this.terminalUI.addMessage(
          `${label} ${colors.bright}${i + 1}.${colors.reset} ${colors.blue}[DM]${colors.reset} ${peerShort}`,
        );
      }
    }

    this.terminalUI.addMessage("");
    this.terminalUI.addMessage(
      `${colors.dim}Use /chat <number> to switch conversations${colors.reset}`,
    );
  }

  // List all conversations and let user select one
  async selectConversation(): Promise<Conversation | null> {
    const agent = await this.initializeAgent();
    const client = agent.client;

    console.log(
      `${colors.yellow}${colors.bright}Syncing conversations...${colors.reset}`,
    );
    await client.conversations.sync();

    this.conversationsList = await client.conversations.list();

    if (this.conversationsList.length === 0) {
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
    for (let i = 0; i < this.conversationsList.length; i++) {
      const conv = this.conversationsList[i];
      const isGroup = conv.constructor.name === "Group";

      if (isGroup) {
        const group = conv as Group;
        const members = await conv.members();
        console.log(
          `${colors.bright}${i + 1}.${colors.reset} ${colors.green}[GROUP]${colors.reset} ${group.name || "Unnamed Group"}`,
        );
        console.log(
          `   ${colors.dim}${members.length} members • ID: ${conv.id.slice(0, 12)}...${colors.reset}`,
        );
      } else {
        const dm = conv as Dm;
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
        `${colors.yellow}Select a conversation (1-${this.conversationsList.length}) or 'q' to quit: ${colors.reset}`,
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
    if (isNaN(index) || index < 0 || index >= this.conversationsList.length) {
      console.log(`${colors.red}Invalid selection!${colors.reset}`);
      return null;
    }

    return this.conversationsList[index];
  }

  // Switch to a different conversation by index
  private async switchToConversation(index: number): Promise<void> {
    if (index < 0 || index >= this.conversationsList.length) {
      const errorMsg = `${colors.red}Invalid conversation number. Use /conversations to see the list.${colors.reset}`;
      if (this.terminalUI && this.rl && this.currentConversation) {
        this.terminalUI.addAndRefresh(
          errorMsg,
          this.currentConversation,
          this.rl,
        );
      }
      return;
    }

    const newConversation = this.conversationsList[index];

    // Stop current streaming
    await this.stopMessageStream();

    // Clean up current UI
    if (this.rl) {
      this.rl.close();
    }

    // Start chat in new conversation
    await this.chatInConversation(newConversation);
  }

  // Format a message for display
  private formatMessage(message: DecodedMessage, isFromSelf: boolean): string {
    const timestamp = message.sentAt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const senderShort = message.senderInboxId.slice(0, 8);
    const sender = isFromSelf
      ? `${colors.green}${colors.bright}You${colors.reset}`
      : `${colors.cyan}${senderShort}${colors.reset}`;

    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

    return `${colors.dim}[${timestamp}]${colors.reset} ${sender}: ${content}`;
  }

  // Start streaming messages from the conversation
  private async startMessageStream(conversation: Conversation): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    this.isStreaming = true;
    const agent = await this.initializeAgent();
    const client = agent.client;

    try {
      // Stream messages using the client's streaming API
      this.messageStream = await client.conversations.streamAllMessages();

      (async () => {
        if (!this.messageStream) return;

        for await (const message of this.messageStream) {
          // Only show messages from the current conversation
          if (message.conversationId !== conversation.id) {
            continue;
          }

          const isFromSelf = message.senderInboxId === client.inboxId;

          // Format and add message to UI
          const formattedMessage = this.formatMessage(message, isFromSelf);

          if (this.terminalUI && this.rl) {
            this.terminalUI.addAndRefresh(
              formattedMessage,
              conversation,
              this.rl,
            );
          }
        }
      })().catch((error) => {
        console.error(
          `${colors.red}Error in message stream:${colors.reset}`,
          error,
        );
        this.isStreaming = false;
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
      // Streams from generators don't have stop(), we just stop consuming
      this.messageStream = null;
    }
    this.isStreaming = false;
  }

  // Chat in the selected conversation
  async chatInConversation(conversation: Conversation): Promise<boolean> {
    this.currentConversation = conversation;
    const agent = await this.initializeAgent();
    const client = agent.client;

    // Initialize Terminal UI
    this.terminalUI = new TerminalUI();

    // Load recent messages
    await conversation.sync();
    const messages = await conversation.messages();

    // Add messages to terminal UI buffer
    const recentMessages = messages.slice(-50); // Load more messages for scrolling
    for (const message of recentMessages) {
      const isFromSelf = message.senderInboxId === client.inboxId;
      const formattedMessage = this.formatMessage(message, isFromSelf);
      this.terminalUI.addMessage(formattedMessage);
    }

    // Initial render
    this.terminalUI.render(
      conversation,
      `${colors.green}${colors.bright}You${colors.reset} ${colors.dim}>${colors.reset} `,
    );

    // Start streaming new messages
    await this.startMessageStream(conversation);

    // Setup readline for input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.green}${colors.bright}You${colors.reset} ${colors.dim}>${colors.reset} `,
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
          this.terminalUI?.clear();
          this.terminalUI = null;
          resolve(true); // Return to conversation list
          return;
        }

        if (message === "/exit") {
          await this.stopMessageStream();
          this.rl!.close();
          this.terminalUI?.clear();
          this.terminalUI = null;
          resolve(false); // Exit app
          return;
        }

        if (message === "/conversations") {
          await this.displayConversationsInChat();
          if (this.terminalUI && this.rl) {
            this.terminalUI.addAndRefresh("", conversation, this.rl);
          }
          this.rl!.prompt();
          return;
        }

        if (message.startsWith("/chat ")) {
          const parts = message.split(" ");
          if (parts.length === 2) {
            const index = parseInt(parts[1]) - 1;
            if (!isNaN(index)) {
              // Resolve to indicate we're switching conversations
              await this.switchToConversation(index);
              return;
            }
          }
          const errorMsg = `${colors.red}Usage: /chat <number>${colors.reset}`;
          if (this.terminalUI && this.rl) {
            this.terminalUI.addAndRefresh(errorMsg, conversation, this.rl);
          }
          this.rl!.prompt();
          return;
        }

        // Send message
        try {
          await conversation.send(message);
          // Message will appear via stream
        } catch {
          const errorMsg = `${colors.red}✗ Failed to send message${colors.reset}`;
          if (this.terminalUI && this.rl) {
            this.terminalUI.addAndRefresh(errorMsg, conversation, this.rl);
          }
        }

        this.rl!.prompt();
      });

      this.rl!.on("close", async () => {
        await this.stopMessageStream();
        this.terminalUI?.clear();
        this.terminalUI = null;
        resolve(false);
      });
    });
  }

  // Main chat loop
  async start(agentIdentifier?: string): Promise<void> {
    try {
      await this.initializeAgent();

      // If agent identifier is provided, go directly to that conversation
      if (agentIdentifier) {
        // Load conversations list for quick switching
        const client = this.agent!.client;
        await client.conversations.sync();
        this.conversationsList = await client.conversations.list();

        const conversation =
          await this.findOrCreateConversation(agentIdentifier);

        if (!conversation) {
          console.log(
            `${colors.red}Failed to connect to agent. Exiting...${colors.reset}`,
          );
          return;
        }

        // Update conversations list after creating new conversation
        await client.conversations.sync();
        this.conversationsList = await client.conversations.list();

        await this.chatInConversation(conversation);
      } else {
        // Normal flow: let user select from conversations
        let keepRunning = true;

        while (keepRunning) {
          const conversation = await this.selectConversation();

          if (!conversation) {
            console.log(`\n${colors.yellow}Goodbye!${colors.reset}`);
            break;
          }

          keepRunning = await this.chatInConversation(conversation);
        }
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
function parseArgs(): { env: XmtpEnv; help: boolean; agent?: string } {
  const args = process.argv.slice(2);
  let env = (process.env.XMTP_ENV as XmtpEnv) || "production";
  let help = false;
  let agent: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--env" && nextArg) {
      env = nextArg as XmtpEnv;
      i++;
    } else if (arg === "--agent" && nextArg) {
      agent = nextArg;
      i++;
    }
  }

  return { env, help, agent };
}

function showHelp(): void {
  console.log(`
${colors.cyan}${colors.bright}XMTP CLI Chat Interface${colors.reset}

Chat with your XMTP conversations directly from the terminal.

${colors.bright}USAGE:${colors.reset}
  yarn chat [options]

${colors.bright}OPTIONS:${colors.reset}
  --agent <address>      Connect directly to an agent by Ethereum address or inbox ID
  --env <environment>    XMTP environment (local, dev, production)
                        [default: production or XMTP_ENV]
  -h, --help            Show this help message

${colors.bright}IN-CHAT COMMANDS:${colors.reset}
  /conversations         List all your conversations with numbers
  /chat <number>         Switch to a different conversation
  /back                  Return to conversation list
  /exit                  Quit the application

${colors.bright}EXAMPLES:${colors.reset}
  yarn chat
  yarn chat --env dev
  yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2
  yarn chat --agent 1180478fde9f6dfd4559c25f99f1a3f1505e1ad36b9c3a4dd3d5afb68c419179

${colors.bright}ENVIRONMENT VARIABLES:${colors.reset}
  XMTP_ENV          Default environment
  WALLET_KEY        Wallet private key (required)
  ENCRYPTION_KEY    Database encryption key (required)
`);
}

// CLI entry point
async function main(): Promise<void> {
  const { env, help, agent } = parseArgs();

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

  await chat.start(agent);
}

void main();
