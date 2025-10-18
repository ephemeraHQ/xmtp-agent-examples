// MOCK AGENT ADDRESS 0x7723d790A5e00b650BF146A0961F8Bb148F0450C

import {
  Agent,
  type XmtpEnv,
  IdentifierKind,
  type Group,
  type Dm,
} from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { fromString } from "uint8arrays/from-string";

class MockXmtpAgent {
  private agent: Agent | null = null;

  constructor() {}

  async initializeAgent(): Promise<Agent> {
    const walletKey = process.env.XMTP_CLIENT_WALLET_KEY;
    const encryptionKey = process.env.XMTP_CLIENT_DB_ENCRYPTION_KEY;
    if (!walletKey || !encryptionKey) {
      throw new Error(
        "WALLET_KEY and ENCRYPTION_KEY must be set in environment",
      );
    }
    const user = createUser(walletKey as `0x${string}`);
    const signer = createSigner(user);
    const dbEncryptionKey = fromString(
      process.env.XMTP_CLIENT_DB_ENCRYPTION_KEY!,
      "hex",
    );
    this.agent = await Agent.create(signer, {
      env: process.env.XMTP_ENV as XmtpEnv,
      dbEncryptionKey,
    });
    console.log(`📖 Initialized XMTP agent: ${this.agent?.address}`);
    return this.agent as Agent;
  }

  // List all conversations with details
  async listConversations(): Promise<void> {
    const agent = await this.initializeAgent();

    // Sync conversations to get latest state
    await agent.client.conversations.sync();

    // Get all conversations
    const conversations = await agent.client.conversations.list();
    const groups = conversations.filter(
      (conv) => conv.constructor.name === "Group",
    );
    const dms = conversations.filter((conv) => conv.constructor.name === "Dm");

    console.log(`\n📊 XMTP CONVERSATIONS (${conversations.length} total):`);
    console.log(`Environment: ${process.env.XMTP_ENV}`);
    console.log(`Client Inbox ID: ${agent.client.inboxId}`);
    console.log("─".repeat(80));

    if (conversations.length === 0) {
      console.log("No conversations found");
      return;
    }

    // List groups
    if (groups.length > 0) {
      console.log(`\n🏗️  GROUPS (${groups.length}):`);
      for (const group of groups) {
        const groupData = group as Group;
        console.log(`\n   Group: ${groupData.name || "Unnamed"}`);
        console.log(`   ID: ${group.id}`);
        console.log(
          `   Description: ${groupData.description || "No description"}`,
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
        const dmData = dm as Dm;
        console.log(`\n   DM with: ${dmData.peerInboxId}`);
        console.log(`   ID: ${dm.id}`);
      }
    }
  }

  // List messages for a specific conversation
  async listMessages(conversationId: string): Promise<void> {
    const agent = await this.initializeAgent();

    // Get the conversation
    const conversation =
      await agent.client.conversations.getConversationById(conversationId);

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
      const groupData = conversation as Group;
      console.log(`Group Name: ${groupData.name || "Unnamed"}`);
    } else if (conversation.constructor.name === "Dm") {
      const dmData = conversation as Dm;
      console.log(`Peer: ${dmData.peerInboxId}`);
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
    const agent = await this.initializeAgent();

    console.log(`\n🆔 XMTP IDENTITY CHECK:`);
    console.log(`Environment: ${process.env.XMTP_ENV}`);
    console.log("─".repeat(80));

    // Get inbox ID
    console.log(`📬 Inbox ID: ${agent.client.inboxId}`);

    // Get installation ID
    console.log(`🔧 Installation ID: ${agent.client.installationId}`);

    // Get address
    console.log(`💰 Address: ${agent.address}`);
  }
}

// Global mock agent instance
const mockAgent = new MockXmtpAgent();

// CLI Configuration
interface MockConfig {
  operation: "conversations" | "messages" | "identity";
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
  -h, --help                Show this help message

EXAMPLES:
  # List all conversations
  yarn mock conversations

  # List messages for a specific conversation
  yarn mock messages fcba2fced9910c95d91f1ae4dcac2f41

  # Check your identity
  yarn mock identity

ENVIRONMENT VARIABLES:
  XMTP_ENV                      XMTP environment (local, dev, production)
  XMTP_CLIENT_WALLET_KEY        Wallet private key (required)
  XMTP_CLIENT_DB_ENCRYPTION_KEY Database encryption key (required)

For more information, see: cli/readme.md
`);
}

function parseArgs(): MockConfig {
  const args = process.argv.slice(2);
  const config: MockConfig = {
    operation: "conversations",
  };

  // First argument is the operation
  if (args.length > 0 && !args[0].startsWith("--")) {
    config.operation = args[0] as MockConfig["operation"];
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

    if (arg === "--help" || arg === "-h") {
      showHelp();
      process.exit(0);
    }
  }

  return config;
}

// Operation: List conversations
async function runConversationsOperation(): Promise<void> {
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

  try {
    await mockAgent.listMessages(config.conversationId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list messages: ${errorMessage}`);
  }
}

// Operation: Check identity
async function runIdentityOperation(): Promise<void> {
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
        await runConversationsOperation();
        break;
      case "messages":
        await runMessagesOperation(config);
        break;
      case "identity":
        await runIdentityOperation();
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
