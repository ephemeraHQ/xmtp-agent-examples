import "dotenv/config";
import {
  APP_VERSION,
  createSigner,
  getEncryptionKeyFromHex,
} from "@helpers/client";
import {
  getActiveVersion,
  IdentifierKind,
  type Client,
  type XmtpEnv,
} from "@versions/node-sdk";

// MOCK AGENT ADDRESS 0x7723d790A5e00b650BF146A0961F8Bb148F0450C

class MockXmtpAgent {
  private client: Client | null = null;

  constructor(public env: XmtpEnv = "production") {}

  // Initialize the single fixed client
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

    // @ts-expect-error - TODO: fix this
    this.client = await getActiveVersion().Client.create(signer, {
      dbEncryptionKey,
      env: this.env,
      appVersion: APP_VERSION,
    });

    console.log(`📖 Initialized XMTP client: ${this.client?.inboxId}`);
    return this.client as Client;
  }

  // List all conversations with details
  async listConversations(): Promise<void> {
    const client = await this.initializeClient();

    // Sync conversations to get latest state
    await client.conversations.sync();

    // Get all conversations
    const conversations = await client.conversations.list();
    const groups = conversations.filter(
      (conv) => conv.constructor.name === "Group",
    );
    const dms = conversations.filter((conv) => conv.constructor.name === "Dm");

    console.log(`\n📊 XMTP CONVERSATIONS (${conversations.length} total):`);
    console.log(`Environment: ${this.env}`);
    console.log(`Client Inbox ID: ${client.inboxId}`);
    console.log("─".repeat(80));

    if (conversations.length === 0) {
      console.log("No conversations found");
      return;
    }

    // List groups
    if (groups.length > 0) {
      console.log(`\n🏗️  GROUPS (${groups.length}):`);
      for (const group of groups) {
        console.log(`\n   Group: ${(group as any).name || "Unnamed"}`);
        console.log(`   ID: ${group.id}`);
        console.log(
          `   Description: ${(group as any).description || "No description"}`,
        );

        const members = await group.members();
        console.log(`   Members: ${members.length}`);

        // Show member details
        for (const member of members) {
          const ethAddress = member.accountIdentifiers.find(
            (id) => id.identifierKind === IdentifierKind.Ethereum,
          )?.identifier;
          console.log(
            `     - ${member.inboxId} (${ethAddress || "no address"})`,
          );
        }
      }
    }

    // List DMs
    if (dms.length > 0) {
      console.log(`\n💬 DIRECT MESSAGES (${dms.length}):`);
      for (const dm of dms) {
        console.log(`\n   DM with: ${(dm as any).peerInboxId}`);
        console.log(`   ID: ${dm.id}`);
      }
    }
  }

  // List messages for a specific conversation
  async listMessages(conversationId: string): Promise<void> {
    const client = await this.initializeClient();

    // Get the conversation
    const conversation =
      await client.conversations.getConversationById(conversationId);

    if (!conversation) {
      console.error(`❌ Conversation not found: ${conversationId}`);
      return;
    }

    // Get messages
    const messages = await conversation.messages();

    console.log(`\n📨 MESSAGES FOR CONVERSATION:`);
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`Type: ${conversation.constructor.name}`);

    if (conversation.constructor.name === "Group") {
      console.log(`Group Name: ${(conversation as any).name || "Unnamed"}`);
    } else if (conversation.constructor.name === "Dm") {
      console.log(`Peer: ${(conversation as any).peerInboxId}`);
    }

    console.log(`Total Messages: ${messages.length}`);
    console.log("─".repeat(80));

    if (messages.length === 0) {
      console.log("No messages found");
      return;
    }

    // Show messages
    for (const message of messages) {
      console.log(`\n   [${message.sentAt.toISOString()}]`);
      console.log(`   From: ${message.senderInboxId}`);
      console.log(`   Content: "${message.content as string}"`);
    }
  }

  // Check your own inbox ID and address
  async checkIdentity(): Promise<void> {
    const client = await this.initializeClient();

    console.log(`\n🆔 XMTP IDENTITY CHECK:`);
    console.log(`Environment: ${this.env}`);
    console.log("─".repeat(80));

    // Get inbox ID
    console.log(`📬 Inbox ID: ${client.inboxId}`);

    // Get installation ID
    console.log(`🔧 Installation ID: ${client.installationId}`);

    // Get Ethereum address from signer
    const signer = client.signer;
    if (signer) {
      const identifier = await signer.getIdentifier();

      if (identifier.identifierKind === IdentifierKind.Ethereum) {
        // Ethereum
        console.log(`💰 Ethereum Address: ${identifier.identifier}`);
      } else {
        console.log(`🔑 Address Type: ${identifier.identifierKind}`);
        console.log(`🔑 Address: ${identifier.identifier}`);
      }
    } else {
      console.log(`🔑 Address: Unable to get signer information`);
    }

    // Get wallet key info (masked for security)
    const walletKey = process.env.WALLET_KEY;
    if (walletKey) {
      const maskedKey = walletKey.slice(0, 6) + "..." + walletKey.slice(-4);
      console.log(`🔐 Wallet Key: ${maskedKey}`);
    }

    // Get encryption key info (masked for security)
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (encryptionKey) {
      const maskedKey =
        encryptionKey.slice(0, 6) + "..." + encryptionKey.slice(-4);
      console.log(`🔒 Encryption Key: ${maskedKey}`);
    }
  }
}

// Global mock agent instance
let globalMockAgent: MockXmtpAgent | null = null;

function getMockAgent(env: XmtpEnv = "production"): MockXmtpAgent {
  if (!globalMockAgent || globalMockAgent.env !== env) {
    globalMockAgent = new MockXmtpAgent(env);
  }
  return globalMockAgent;
}

// CLI Configuration
interface MockConfig {
  operation: string;
  env: string;
  conversationId?: string;
}

function showHelp() {
  console.log(`
XMTP Mock Agent CLI - Read-only XMTP query tool

USAGE:
  yarn mock <operation> [options]

OPERATIONS:
  conversations              List all conversations with details
  messages <conversation-id> List messages for a specific conversation
  identity                   Check your own inbox ID and address

OPTIONS:
  --env <environment>        XMTP environment (local, dev, production) [default: production]
  -h, --help                Show this help message

EXAMPLES:
  # List all conversations
  yarn mock conversations --env local

  # List messages for a specific conversation
  yarn mock messages fcba2fced9910c95d91f1ae4dcac2f41 --env local

  # Check your identity
  yarn mock identity --env local

ENVIRONMENT VARIABLES:
  XMTP_ENV             Default environment
  WALLET_KEY           Wallet private key (required)
  ENCRYPTION_KEY       Database encryption key (required)

For more information, see: cli/readme.md
`);
}

function parseArgs(): MockConfig {
  const args = process.argv.slice(2);
  const config: MockConfig = {
    operation: "conversations",
    env: process.env.XMTP_ENV ?? "production",
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    config.operation = args[0];
    args.shift(); // Remove operation from args
  }

  // Second argument for messages operation is conversation ID
  if (
    config.operation === "messages" &&
    args.length > 0 &&
    !args[0].startsWith("--")
  ) {
    config.conversationId = args[0];
    args.shift(); // Remove conversation ID from args
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    } else if (arg === "--env" && nextArg) {
      config.env = nextArg;
      i++;
    }
  }

  return config;
}

// Operation: List conversations
async function runConversationsOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as XmtpEnv);

  try {
    await mockAgent.listConversations();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list conversations: ${errorMessage}`);
  }
}

// Operation: List messages
async function runMessagesOperation(config: MockConfig): Promise<void> {
  if (!config.conversationId) {
    console.error(
      "❌ Error: Conversation ID is required for messages operation",
    );
    console.log("   Usage: yarn mock messages <conversation-id>");
    return;
  }

  const mockAgent = getMockAgent(config.env as XmtpEnv);

  try {
    await mockAgent.listMessages(config.conversationId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list messages: ${errorMessage}`);
  }
}

// Operation: Check identity
async function runIdentityOperation(config: MockConfig): Promise<void> {
  const mockAgent = getMockAgent(config.env as XmtpEnv);

  try {
    await mockAgent.checkIdentity();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to check identity: ${errorMessage}`);
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    switch (config.operation) {
      case "conversations":
        await runConversationsOperation(config);
        break;
      case "messages":
        await runMessagesOperation(config);
        break;
      case "identity":
        await runIdentityOperation(config);
        break;
      default:
        console.error(`❌ Unknown operation: ${config.operation}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    process.exit(1);
  }

  process.exit(0);
}

void main();
