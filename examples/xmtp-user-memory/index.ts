import fs from "fs";
import path from "path";
import {
  createSigner,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

// Storage directory for user profiles
const USER_STORAGE_DIR = ".data/user-profiles";

// User profile interface
interface UserProfile {
  inboxId: string;
  address?: string;
  name?: string;
  email?: string;
  preferences?: {
    notifications?: boolean;
    language?: string;
    timezone?: string;
  };
  notes?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  conversationHistory?: {
    lastSeen: string;
    messageCount: number;
  };
}

/**
 * Ensure local storage directory exists
 */
function ensureUserStorage(): void {
  if (!fs.existsSync(USER_STORAGE_DIR)) {
    fs.mkdirSync(USER_STORAGE_DIR, { recursive: true });
    console.log(`Created user storage directory: ${USER_STORAGE_DIR}`);
  }
}

/**
 * Get user profile file path
 */
function getUserProfilePath(inboxId: string): string {
  return path.join(USER_STORAGE_DIR, `${inboxId}.json`);
}

/**
 * Load user profile from storage
 */
function loadUserProfile(inboxId: string): UserProfile | null {
  const profilePath = getUserProfilePath(inboxId);
  try {
    if (fs.existsSync(profilePath)) {
      const data = fs.readFileSync(profilePath, "utf8");
      return JSON.parse(data) as UserProfile;
    }
  } catch (error) {
    console.error(`Error loading user profile for ${inboxId}:`, error);
  }
  return null;
}

/**
 * Save user profile to storage
 */
function saveUserProfile(profile: UserProfile): void {
  const profilePath = getUserProfilePath(profile.inboxId);
  try {
    profile.updatedAt = new Date().toISOString();
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    console.log(`Saved profile for user: ${profile.inboxId}`);
  } catch (error) {
    console.error(`Error saving user profile for ${profile.inboxId}:`, error);
  }
}

/**
 * Create a new user profile
 */
function createUserProfile(inboxId: string, address?: string): UserProfile {
  const now = new Date().toISOString();
  return {
    inboxId,
    address,
    createdAt: now,
    updatedAt: now,
    notes: [],
    tags: [],
    conversationHistory: {
      lastSeen: now,
      messageCount: 0,
    },
  };
}

/**
 * Update user conversation history
 */
function updateConversationHistory(profile: UserProfile): void {
  if (!profile.conversationHistory) {
    profile.conversationHistory = {
      lastSeen: new Date().toISOString(),
      messageCount: 1,
    };
  } else {
    profile.conversationHistory.lastSeen = new Date().toISOString();
    profile.conversationHistory.messageCount++;
  }
}

/**
 * Parse and execute user commands
 */
async function handleUserCommand(
  message: string,
  inboxId: string,
  address?: string,
): Promise<string> {
  const command = message.toLowerCase().trim();
  let profile = loadUserProfile(inboxId);

  // Create profile if it doesn't exist
  if (!profile) {
    profile = createUserProfile(inboxId, address);
    saveUserProfile(profile);
  }

  // Update conversation history
  updateConversationHistory(profile);

  // Handle different commands
  if (command === "/help" || command === "help") {
    return `🤖 **User Memory Agent Commands:**

**Profile Management:**
• \`/profile\` - View your saved profile
• \`/set name <name>\` - Set your name
• \`/set email <email>\` - Set your email
• \`/set timezone <timezone>\` - Set your timezone
• \`/set language <language>\` - Set your language

**Notes & Tags:**
• \`/add note <note>\` - Add a personal note
• \`/add tag <tag>\` - Add a tag to your profile
• \`/notes\` - View all your notes
• \`/tags\` - View all your tags

**Preferences:**
• \`/set notifications on/off\` - Toggle notifications
• \`/preferences\` - View your preferences

**Other:**
• \`/stats\` - View your conversation statistics
• \`/clear notes\` - Clear all notes
• \`/clear tags\` - Clear all tags
• \`/help\` - Show this help message

Your data is stored securely and persists across sessions! 🔐`;
  }

  if (command === "/profile") {
    const stats = profile.conversationHistory || {
      lastSeen: "Unknown",
      messageCount: 0,
    };
    return `👤 **Your Profile:**

**Basic Info:**
• Name: ${profile.name || "Not set"}
• Email: ${profile.email || "Not set"}
• Address: ${profile.address || "Not provided"}
• Member since: ${new Date(profile.createdAt).toLocaleDateString()}

**Preferences:**
• Language: ${profile.preferences?.language || "Not set"}
• Timezone: ${profile.preferences?.timezone || "Not set"}
• Notifications: ${profile.preferences?.notifications ? "Enabled" : "Disabled"}

**Activity:**
• Total messages: ${stats.messageCount}
• Last seen: ${new Date(stats.lastSeen).toLocaleString()}
• Notes: ${profile.notes?.length || 0}
• Tags: ${profile.tags?.length || 0}`;
  }

  if (command.startsWith("/set name ")) {
    const name = message.slice(10).trim();
    profile.name = name;
    saveUserProfile(profile);
    return `✅ Name updated to: **${name}**`;
  }

  if (command.startsWith("/set email ")) {
    const email = message.slice(11).trim();
    profile.email = email;
    saveUserProfile(profile);
    return `✅ Email updated to: **${email}**`;
  }

  if (command.startsWith("/set timezone ")) {
    const timezone = message.slice(14).trim();
    if (!profile.preferences) profile.preferences = {};
    profile.preferences.timezone = timezone;
    saveUserProfile(profile);
    return `✅ Timezone updated to: **${timezone}**`;
  }

  if (command.startsWith("/set language ")) {
    const language = message.slice(14).trim();
    if (!profile.preferences) profile.preferences = {};
    profile.preferences.language = language;
    saveUserProfile(profile);
    return `✅ Language updated to: **${language}**`;
  }

  if (command === "/set notifications on") {
    if (!profile.preferences) profile.preferences = {};
    profile.preferences.notifications = true;
    saveUserProfile(profile);
    return `✅ Notifications **enabled**`;
  }

  if (command === "/set notifications off") {
    if (!profile.preferences) profile.preferences = {};
    profile.preferences.notifications = false;
    saveUserProfile(profile);
    return `✅ Notifications **disabled**`;
  }

  if (command.startsWith("/add note ")) {
    const note = message.slice(10).trim();
    if (!profile.notes) profile.notes = [];
    profile.notes.push(`${new Date().toISOString()}: ${note}`);
    saveUserProfile(profile);
    return `✅ Note added: **${note}**`;
  }

  if (command.startsWith("/add tag ")) {
    const tag = message.slice(9).trim().toLowerCase();
    if (!profile.tags) profile.tags = [];
    if (!profile.tags.includes(tag)) {
      profile.tags.push(tag);
      saveUserProfile(profile);
      return `✅ Tag added: **${tag}**`;
    } else {
      return `ℹ️ Tag **${tag}** already exists`;
    }
  }

  if (command === "/notes") {
    if (!profile.notes || profile.notes.length === 0) {
      return `📝 **Your Notes:** No notes saved yet. Use \`/add note <note>\` to add one!`;
    }
    const notesList = profile.notes
      .map((note, index) => `${index + 1}. ${note}`)
      .join("\n");
    return `📝 **Your Notes:**\n${notesList}`;
  }

  if (command === "/tags") {
    if (!profile.tags || profile.tags.length === 0) {
      return `🏷️ **Your Tags:** No tags saved yet. Use \`/add tag <tag>\` to add one!`;
    }
    const tagsList = profile.tags.map((tag) => `#${tag}`).join(", ");
    return `🏷️ **Your Tags:** ${tagsList}`;
  }

  if (command === "/preferences") {
    const prefs = profile.preferences || {};
    return `⚙️ **Your Preferences:**
• Language: ${prefs.language || "Not set"}
• Timezone: ${prefs.timezone || "Not set"}
• Notifications: ${prefs.notifications ? "Enabled" : "Disabled"}`;
  }

  if (command === "/stats") {
    const stats = profile.conversationHistory || {
      lastSeen: "Unknown",
      messageCount: 0,
    };
    const memberSince = Math.floor(
      (Date.now() - new Date(profile.createdAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return `📊 **Your Statistics:**
• Member for: ${memberSince} days
• Total messages: ${stats.messageCount}
• Notes saved: ${profile.notes?.length || 0}
• Tags created: ${profile.tags?.length || 0}
• Last active: ${new Date(stats.lastSeen).toLocaleString()}`;
  }

  if (command === "/clear notes") {
    profile.notes = [];
    saveUserProfile(profile);
    return `✅ All notes cleared`;
  }

  if (command === "/clear tags") {
    profile.tags = [];
    saveUserProfile(profile);
    return `✅ All tags cleared`;
  }

  // Default response for unknown commands
  saveUserProfile(profile); // Save the updated conversation history
  const greeting = profile.name ? `Hello ${profile.name}! 👋` : "Hello! 👋";
  return `${greeting} I'm your personal memory agent. I remember your details across all our conversations!

Type \`/help\` to see what I can do for you, or \`/profile\` to view your saved information.

💡 **Quick tip:** You can start by setting your name with \`/set name <your name>\``;
}

/**
 * Get user's Ethereum address from their inbox ID
 */
async function getUserAddress(
  client: Client,
  inboxId: string,
): Promise<string | undefined> {
  try {
    const inboxState = await client.preferences.inboxStateFromInboxIds([
      inboxId,
    ]);
    if (inboxState && inboxState.length > 0) {
      const ethIdentifier = inboxState[0].identifiers.find(
        (id) => id.identifierKind === 0, // IdentifierKind.Ethereum
      );
      return ethIdentifier?.identifier;
    }
  } catch (error) {
    console.error(`Error getting address for inbox ${inboxId}:`, error);
  }
  return undefined;
}

/**
 * Main function to run the agent
 */
async function main(): Promise<void> {
  console.log("🚀 Starting XMTP User Memory Agent...");

  // Ensure storage directory exists
  ensureUserStorage();

  /* Create the signer using viem and parse the encryption key for the local db */
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  /* Get the signer identifier for unique database path */
  const signerIdentifier = (await signer.getIdentifier()).identifier;

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    dbPath: getDbPath(`${XMTP_ENV}-memory-agent-${signerIdentifier}`),
  });

  void logAgentDetails(client);

  /* Sync the conversations from the network to update the local db */
  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("✓ User Memory Agent ready! Waiting for messages...");

  /* Stream all messages from the network */
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    try {
      /* Skip if the message is from the agent or not text */
      if (
        message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
        message?.contentType?.typeId !== "text"
      ) {
        continue;
      }

      const messageContent = message.content as string;
      const senderInboxId = message.senderInboxId;

      console.log(`📨 Message from ${senderInboxId}: ${messageContent}`);

      // Get user's Ethereum address
      const userAddress = await getUserAddress(client, senderInboxId);

      // Handle the command and get response
      const response = await handleUserCommand(
        messageContent,
        senderInboxId,
        userAddress,
      );

      // Get the conversation and send response
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (conversation) {
        await conversation.send(response);
        console.log(`✅ Response sent to ${senderInboxId}`);
      } else {
        console.error("❌ Could not find conversation to reply to");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("❌ Error processing message:", errorMessage);

      // Try to send an error response
      try {
        if (message) {
          const conversation = await client.conversations.getConversationById(
            message.conversationId,
          );
          if (conversation) {
            await conversation.send(
              "⚠️ Sorry, I encountered an error processing your request. Please try again.",
            );
          }
        }
      } catch (sendError) {
        console.error("❌ Failed to send error message:", sendError);
      }
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down User Memory Agent...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down User Memory Agent...");
  process.exit(0);
});

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
