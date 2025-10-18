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
  private inputHeight = 4; // Lines reserved for input area (top border, input, bottom border, spacing)
  private headerHeight = 3; // Lines for header
  private placeholderText = "Send a message to the agent";

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
    const bgRed = "\x1b[48;2;252;76;52m"; // Background red
    let header = "";

    if (isGroup) {
      const group = conversation as Group;
      header = `${bgRed}${colors.bright} GROUP: ${group.name || "Unnamed Group"} ${colors.reset}`;
    } else {
      const dm = conversation as Dm;
      const peerId = dm.peerInboxId.slice(0, 16) + "...";
      header = `${bgRed}${colors.bright} DM: ${peerId} ${colors.reset}`;
    }

    return header;
  }

  // Render bottom border of input box
  renderInputBottomBorder(): void {
    const width = process.stdout.columns || 80;
    const bottomBorder = `${colors.dim}└${"─".repeat(width - 2)}┘${colors.reset}`;
    console.log(bottomBorder);
  }

  // Clear screen and render full UI
  render(conversation: Conversation, currentInput: string = ""): void {
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
    const targetLine = this.terminalHeight - this.inputHeight - 1;
    if (currentLine < targetLine) {
      process.stdout.write("\n".repeat(targetLine - currentLine));
    }

    // Render input box with top border
    const width = process.stdout.columns || 80;
    const topBorder = `${colors.dim}┌${"─".repeat(width - 2)}┐${colors.reset}`;
    console.log(topBorder);

    // Render input line with placeholder
    this.renderInputLine(currentInput);

    // Render bottom border
    this.renderInputBottomBorder();
  }

  // Render just the input line
  renderInputLine(currentInput: string = ""): void {
    const width = process.stdout.columns || 80;
    const innerWidth = width - 4;

    if (!currentInput) {
      // Show placeholder
      const padding = " ".repeat(
        Math.max(0, innerWidth - this.placeholderText.length),
      );
      console.log(
        `${colors.dim}│${colors.reset} ${colors.dim}${this.placeholderText}${colors.reset}${padding} ${colors.dim}│${colors.reset}`,
      );
    } else {
      // Show current input
      const padding = " ".repeat(Math.max(0, innerWidth - currentInput.length));
      console.log(
        `${colors.dim}│${colors.reset} ${currentInput}${padding} ${colors.dim}│${colors.reset}`,
      );
    }
  }

  // Update only the input line (efficient, no full redraw)
  updateInputLine(currentInput: string = ""): void {
    // Save cursor position
    process.stdout.write("\x1b7");

    // Move to input line (2 lines up from bottom)
    process.stdout.write(`\x1b[${this.terminalHeight - 2}H`);

    // Clear the line
    process.stdout.write("\x1b[2K");

    // Render the new input
    const width = process.stdout.columns || 80;
    const innerWidth = width - 4;

    if (!currentInput) {
      // Show placeholder
      const padding = " ".repeat(
        Math.max(0, innerWidth - this.placeholderText.length),
      );
      process.stdout.write(
        `${colors.dim}│${colors.reset} ${colors.dim}${this.placeholderText}${colors.reset}${padding} ${colors.dim}│${colors.reset}`,
      );
    } else {
      // Show current input
      const padding = " ".repeat(Math.max(0, innerWidth - currentInput.length));
      process.stdout.write(
        `${colors.dim}│${colors.reset} ${currentInput}${padding} ${colors.dim}│${colors.reset}`,
      );
    }

    // Restore cursor position and move to input position
    process.stdout.write(`\x1b[${this.terminalHeight - 2}H`);
    process.stdout.write("\x1b[" + (currentInput.length + 3) + "G");
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

    // Re-render everything (includes borders)
    this.render(conversation, currentInput);

    // Move cursor back up to input line and position it correctly
    process.stdout.write("\x1b[2A"); // Move up 2 lines (past bottom border and input line)
    process.stdout.write("\x1b[" + (currentInput.length + 3) + "G"); // Move to correct column (| + space + input length)

    // Restore readline's input
    if (currentInput) {
      rlWithLine.line = currentInput;
      rlWithLine.cursor = currentInput.length;
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

    // Shorten IDs for display
    const shortInboxId = `${inboxId.slice(0, 8)}...${inboxId.slice(-8)}`;
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    // Red color for everything
    const red = "\x1b[38;2;252;76;52m";

    // Logo lines - all in red
    const logoLines = [
      ` ██╗  ██╗███╗   ███╗████████╗██████╗ `,
      ` ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗`,
      `  ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝`,
      `  ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ `,
      ` ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     `,
      ` ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     `,
    ];

    // Details lines - all in red
    const detailsLines = [
      `${red}${colors.bright}✓ XMTP Client Initialized${colors.reset}`,
      `${colors.dim}InboxId:${colors.reset} ${red}${shortInboxId}${colors.reset}`,
      `${colors.dim}Address:${colors.reset} ${red}${shortAddress}${colors.reset}`,
      `${colors.dim}Conversations:${colors.reset} ${red}${conversations.length}${colors.reset} • ${colors.dim}Installations:${colors.reset} ${red}${inboxState.installations.length}${colors.reset}`,
      `${colors.dim}Network:${colors.reset} ${red}${this.env}${colors.reset}`,
    ];

    // Calculate box width (logo width + spacing + approximate details width)
    const boxWidth = 78;
    const topBorder = `${red}┌${"─".repeat(boxWidth)}┐${colors.reset}`;
    const bottomBorder = `${red}└${"─".repeat(boxWidth)}┘${colors.reset}`;

    // Helper to strip ANSI codes for length calculation
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, ""); // eslint-disable-line no-control-regex

    console.log("");
    console.log(topBorder);

    // Print logo and details side by side with borders
    for (let i = 0; i < Math.max(logoLines.length, detailsLines.length); i++) {
      const logo = logoLines[i] || " ".repeat(39);
      const detail = detailsLines[i] || "";
      const content = `${red}${logo}${colors.reset}  ${detail}`;
      const contentLength = stripAnsi(content).length;
      const padding = " ".repeat(Math.max(0, boxWidth - contentLength - 1));
      console.log(
        `${red}│${colors.reset} ${content}${padding} ${red}│${colors.reset}`,
      );
    }

    console.log(bottomBorder);
    console.log("");
  }

  // Create or find group with multiple addresses
  async findOrCreateGroup(identifiers: string[]): Promise<Conversation | null> {
    const agent = await this.initializeAgent();
    const client = agent.client;

    const red = "\x1b[38;2;252;76;52m";
    console.log(
      `${red}${colors.bright}Creating group with: ${identifiers.join(", ")}${colors.reset}`,
    );

    try {
      // Check if all identifiers are Ethereum addresses
      const allEthAddresses = identifiers.every(
        (id) => id.startsWith("0x") && id.length === 42,
      );

      let group: Group;

      if (allEthAddresses) {
        // Use newGroupWithIdentifiers for Ethereum addresses
        const memberIdentifiers = identifiers.map((id) => ({
          identifier: id,
          identifierKind: IdentifierKind.Ethereum,
        }));

        group = await client.conversations.newGroupWithIdentifiers(
          memberIdentifiers,
          {
            groupName: "CLI Group Chat",
            groupDescription: "Group created from CLI",
          },
        );
      } else {
        // Use newGroup for inbox IDs (or mixed case)
        group = await client.conversations.newGroup(identifiers, {
          groupName: "CLI Group Chat",
          groupDescription: "Group created from CLI",
        });
      }

      console.log(`${red}✓ Created group chat${colors.reset}\n`);
      return group;
    } catch (error) {
      console.error(`${red}Failed to create group:${colors.reset}`, error);
      return null;
    }
  }

  // Find or create conversation with a specific agent (by address or inbox ID)
  async findOrCreateConversation(
    identifier: string,
  ): Promise<Conversation | null> {
    const agent = await this.initializeAgent();
    const client = agent.client;

    const red = "\x1b[38;2;252;76;52m";
    console.log(
      `${red}${colors.bright}Looking for conversation with: ${identifier}${colors.reset}`,
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
          console.log(`${red}✓ Found existing DM with agent${colors.reset}\n`);
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
                `${red}✓ Found existing DM with agent${colors.reset}\n`,
              );
              return conv;
            }
          }
        }
      }
    }

    // No existing conversation found, create new one
    console.log(
      `${red}No existing conversation found. Creating new DM...${colors.reset}`,
    );

    try {
      let newConversation: Dm;

      if (isEthAddress) {
        // Create DM using Ethereum address
        newConversation = await client.conversations.newDmWithIdentifier({
          identifier,
          identifierKind: IdentifierKind.Ethereum,
        });
        console.log(`${red}✓ Created new DM with agent${colors.reset}\n`);
      } else {
        // Create DM using inbox ID
        newConversation = await client.conversations.newDm(identifier);
        console.log(`${red}✓ Created new DM with agent${colors.reset}\n`);
      }

      return newConversation;
    } catch (error) {
      console.error(
        `${red}Failed to create conversation:${colors.reset}`,
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

    const red = "\x1b[38;2;252;76;52m";

    this.terminalUI.addMessage("");

    if (this.conversationsList.length === 0) {
      this.terminalUI.addMessage(`${red}No conversations found${colors.reset}`);
      return;
    }

    for (let i = 0; i < this.conversationsList.length; i++) {
      const conv = this.conversationsList[i];
      const isGroup = conv.constructor.name === "Group";
      const isCurrent = conv.id === this.currentConversation?.id;

      if (isGroup) {
        const group = conv as Group;
        const label = isCurrent ? `${red}●${colors.reset}` : " ";
        this.terminalUI.addMessage(
          `${label} ${colors.bright}${i + 1}.${colors.reset} ${red}[GROUP]${colors.reset} ${group.name || "Unnamed"}`,
        );
      } else {
        const dm = conv as Dm;
        const label = isCurrent ? `${red}●${colors.reset}` : " ";
        const peerShort = dm.peerInboxId.slice(0, 16) + "...";
        this.terminalUI.addMessage(
          `${label} ${colors.bright}${i + 1}.${colors.reset} ${red}[DM]${colors.reset} ${peerShort}`,
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

    const red = "\x1b[38;2;252;76;52m";

    await client.conversations.sync();

    this.conversationsList = await client.conversations.list();

    if (this.conversationsList.length === 0) {
      console.log(
        `${red}No conversations found. Start a conversation on XMTP first!${colors.reset}`,
      );
      return null;
    }

    // Box border
    const width = 60;
    const topBorder = `${red}┌${"─".repeat(width)}┐${colors.reset}`;
    const bottomBorder = `${red}└${"─".repeat(width)}┘${colors.reset}`;
    const titleText = "YOUR CONVERSATIONS";
    const titlePadding = Math.floor((width - titleText.length) / 2);
    const titleLine = `${red}│${" ".repeat(titlePadding)}${colors.bright}${titleText}${colors.reset}${red}${" ".repeat(width - titlePadding - titleText.length)}│${colors.reset}`;

    // Helper to strip ANSI codes for length calculation
    const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, ""); // eslint-disable-line no-control-regex

    console.log(`\n${topBorder}`);
    console.log(titleLine);
    console.log(`${red}├${"─".repeat(width)}┤${colors.reset}`);

    // Display conversations with numbers
    for (let i = 0; i < this.conversationsList.length; i++) {
      const conv = this.conversationsList[i];
      const isGroup = conv.constructor.name === "Group";

      if (isGroup) {
        const group = conv as Group;
        const members = await conv.members();
        const line1 = `${colors.bright}${i + 1}.${colors.reset} ${red}[GROUP]${colors.reset} ${group.name || "Unnamed Group"}`;
        const line2 = `   ${colors.dim}${members.length} members • ID: ${conv.id.slice(0, 12)}...${colors.reset}`;
        const padding1 = " ".repeat(
          Math.max(0, width - stripAnsi(line1).length - 1),
        );
        const padding2 = " ".repeat(
          Math.max(0, width - stripAnsi(line2).length - 1),
        );
        console.log(
          `${red}│${colors.reset} ${line1}${padding1} ${red}│${colors.reset}`,
        );
        console.log(
          `${red}│${colors.reset} ${line2}${padding2} ${red}│${colors.reset}`,
        );
      } else {
        const dm = conv as Dm;
        const line1 = `${colors.bright}${i + 1}.${colors.reset} ${red}[DM]${colors.reset} ${dm.peerInboxId.slice(0, 16)}...`;
        const line2 = `   ${colors.dim}ID: ${conv.id.slice(0, 12)}...${colors.reset}`;
        const padding1 = " ".repeat(
          Math.max(0, width - stripAnsi(line1).length - 1),
        );
        const padding2 = " ".repeat(
          Math.max(0, width - stripAnsi(line2).length - 1),
        );
        console.log(
          `${red}│${colors.reset} ${line1}${padding1} ${red}│${colors.reset}`,
        );
        console.log(
          `${red}│${colors.reset} ${line2}${padding2} ${red}│${colors.reset}`,
        );
      }
      const emptyPadding = " ".repeat(width - 1);
      console.log(
        `${red}│${colors.reset} ${emptyPadding} ${red}│${colors.reset}`,
      );
    }

    console.log(bottomBorder);

    // Get user selection
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const selection = await new Promise<string>((resolve) => {
      rl.question(
        `${red}Select a conversation (1-${this.conversationsList.length}) or 'q' to quit: ${colors.reset}`,
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
      console.log(`${red}Invalid selection!${colors.reset}`);
      return null;
    }

    return this.conversationsList[index];
  }

  // Switch to a different conversation by index
  private async switchToConversation(index: number): Promise<void> {
    const red = "\x1b[38;2;252;76;52m";
    if (index < 0 || index >= this.conversationsList.length) {
      const errorMsg = `${red}Invalid conversation number. Use /conversations to see the list.${colors.reset}`;
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

    const red = "\x1b[38;2;252;76;52m";
    const senderShort = message.senderInboxId.slice(0, 8);
    const sender = isFromSelf
      ? `${red}${colors.bright}You${colors.reset}`
      : `${red}${senderShort}${colors.reset}`;

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
        const red = "\x1b[38;2;252;76;52m";
        console.error(`${red}Error in message stream:${colors.reset}`, error);
        this.isStreaming = false;
      });
    } catch (error) {
      const red = "\x1b[38;2;252;76;52m";
      console.error(`${red}Error streaming messages:${colors.reset}`, error);
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

    // Initial render with bordered input
    this.terminalUI.render(conversation, "");

    // Position cursor at the input line (move up 2 lines to be inside the box)
    process.stdout.write("\x1b[2A"); // Move up past bottom border
    process.stdout.write("\x1b[3G"); // Move to column 3 (after "│ ")

    // Start streaming new messages
    await this.startMessageStream(conversation);

    // Setup readline for input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // We handle terminal output ourselves
    });

    // Set up manual input handling
    let currentLine = "";

    // Override process.stdin handling for better control
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (data: string) => {
      // Handle the input manually
      for (const char of data) {
        if (char === "\n" || char === "\r") {
          // Submit the line
          this.rl!.emit("line", currentLine);
          currentLine = "";
          // Update to show placeholder again
          this.terminalUI!.updateInputLine(currentLine);
        } else if (char === "\x7f" || char === "\b") {
          // Backspace
          if (currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            this.terminalUI!.updateInputLine(currentLine);
          }
        } else if (char >= " " && char <= "~") {
          // Printable character
          currentLine += char;
          this.terminalUI!.updateInputLine(currentLine);
        }
      }
    });

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
          const red = "\x1b[38;2;252;76;52m";
          const errorMsg = `${red}Usage: /chat <number>${colors.reset}`;
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
          const red = "\x1b[38;2;252;76;52m";
          const errorMsg = `${red}✗ Failed to send message${colors.reset}`;
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
  async start(agentIdentifiers?: string[]): Promise<void> {
    try {
      await this.initializeAgent();

      // If agent identifiers are provided, go directly to that conversation
      if (agentIdentifiers && agentIdentifiers.length > 0) {
        // Load conversations list for quick switching
        const client = this.agent!.client;
        await client.conversations.sync();
        this.conversationsList = await client.conversations.list();

        let conversation: Conversation | null;

        // Create group if multiple addresses, DM if single
        if (agentIdentifiers.length > 1) {
          conversation = await this.findOrCreateGroup(agentIdentifiers);
        } else {
          conversation = await this.findOrCreateConversation(
            agentIdentifiers[0],
          );
        }

        if (!conversation) {
          const red = "\x1b[38;2;252;76;52m";
          console.log(
            `${red}Failed to connect to agent(s). Exiting...${colors.reset}`,
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
            const red = "\x1b[38;2;252;76;52m";
            console.log(`\n${red}Goodbye!${colors.reset}`);
            break;
          }

          keepRunning = await this.chatInConversation(conversation);
        }
      }
    } catch (error) {
      const red = "\x1b[38;2;252;76;52m";
      console.error(`${red}Error:${colors.reset}`, error);
    } finally {
      await this.stopMessageStream();
      process.exit(0);
    }
  }
}

// Parse command line arguments
function parseArgs(): { env: XmtpEnv; help: boolean; agents?: string[] } {
  const args = process.argv.slice(2);
  let env = (process.env.XMTP_ENV as XmtpEnv) || "production";
  let help = false;
  const agents: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--env" && nextArg) {
      env = nextArg as XmtpEnv;
      i++;
    } else if (arg === "--agent" && nextArg) {
      // Collect all subsequent non-flag arguments as agent addresses
      i++;
      while (i < args.length && !args[i].startsWith("--")) {
        agents.push(args[i]);
        i++;
      }
      i--; // Step back one since the loop will increment
    }
  }

  return { env, help, agents: agents.length > 0 ? agents : undefined };
}

function showHelp(): void {
  const red = "\x1b[38;2;252;76;52m";
  console.log(`
${red}${colors.bright}XMTP CLI Chat Interface${colors.reset}

Chat with your XMTP conversations directly from the terminal.

${colors.bright}USAGE:${colors.reset}
  yarn chat [options]

${colors.bright}OPTIONS:${colors.reset}
  --agent <address...>   Connect to agent(s) by Ethereum address or inbox ID
                        Single address: creates/opens a DM
                        Multiple addresses: creates a group chat
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
  yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2 0x1234567890abcdef1234567890abcdef12345678
  yarn chat --agent 1180478fde9f6dfd4559c25f99f1a3f1505e1ad36b9c3a4dd3d5afb68c419179

${colors.bright}ENVIRONMENT VARIABLES:${colors.reset}
  XMTP_ENV          Default environment
  WALLET_KEY        Wallet private key (required)
  ENCRYPTION_KEY    Database encryption key (required)
`);
}

// CLI entry point
async function main(): Promise<void> {
  const { env, help, agents } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  console.clear();

  const chat = new XmtpChatCLI(env);

  await chat.start(agents);
}

void main();
