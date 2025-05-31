# Writing XMTP Agents

You're an expert in writing TypeScript with Node.js. Generate **high-quality XMTP Agents** that adhere to the following best practices:

## Guidelines

1.  Use modern TypeScript patterns and ESM modules. All examples should be structured as ES modules with `import` statements rather than CommonJS `require()`.

2.  Use the @xmtp/node-sdk and default to the latest version.

3.  Only import from @xmtp/node-sdk for XMTP functionality. Do not import from any other XMTP-related packages or URLs. Specifically:

    - Never use the deprecated @xmtp/xmtp-js library, which has been completely replaced by @xmtp/node-sdk
    - Always import directly from @xmtp/node-sdk as shown below:

    ```typescript
    // CORRECT:
    import { Client, type Conversation, type XmtpEnv } from "@xmtp/node-sdk";

    // INCORRECT - DEPRECATED:
    import { Client } from "@xmtp/xmtp-js";
    import { XmtpClient } from "some-other-package";
    ```

4.  Follow the consistent pattern for initializing XMTP clients:

    ```typescript
    const signer = createSigner(WALLET_KEY);
    const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
    const client = await Client.create(signer, {
      dbEncryptionKey: encryptionKey,
      env: XMTP_ENV as XmtpEnv,
    });
    ```

5.  Use proper environment variable validation at the start of each application. Check for required environment variables and show descriptive errors if missing.

6.  Never use the concept of "topic" when working with XMTP. The current SDK doesn't use topics for message organization - work directly with conversations, groups, and DMs instead.

7.  Handle both Group and DM conversations properly. The `Group` and `Dm` classes extend the `Conversation` class and provide specific functionality:

    ```typescript
    if (conversation instanceof Group) {
      // Group-specific functionality like group.name or group.addMembers
    } else if (conversation instanceof Dm) {
      // DM-specific functionality like conversation.peerInboxId
    }
    ```

8.  Always sync conversations before streaming messages:

    ```typescript
    await client.conversations.sync();
    const stream = client.conversations.streamAllMessages();
    ```

9.  Filter out messages from the agent itself to prevent endless loops:

    ```typescript
    if (message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }
    ```

10. Consistent error handling pattern with try/catch blocks and specific error messages.

11. Use the helper functions from the shared helpers directory for common operations:

    - `createSigner` - Creates a signer from a private key
    - `getEncryptionKeyFromHex` - Converts a hex string to an encryption key

12. Always import helpers from the `@helpers` path, not from a relative path:

    ```typescript
    // CORRECT:
    import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";

    // INCORRECT:
    import { createSigner, getEncryptionKeyFromHex } from "./helpers";
    ```

13. When creating a group, use the correct options interface:

    ```typescript
    // CORRECT:
    const group = await client.conversations.newGroup([inboxId], {
      groupName: "My Group Name",
      groupDescription: "My group description",
      groupImageUrlSquare: "https://example.com/image.jpg",
    });

    // INCORRECT:
    const group = await client.conversations.newGroup([inboxId], {
      metadata: {
        name: "My Group Name",
      },
    });
    ```

14. When checking message content types, use string literals instead of importing a non-existent ContentTypeId enum:

    ```typescript
    // CORRECT:
    if (message?.contentType?.typeId !== "text") {
      continue;
    }

    // INCORRECT:
    import { ContentTypeId } from "@xmtp/node-sdk";
    if (message?.contentType?.typeId !== ContentTypeId.Text) {
      continue;
    }
    ```

15. Get information about a message sender by using the conversation's members method, not by trying to call a non-existent sender() method on the message:

    ```typescript
    // CORRECT: Use inboxStateFromInboxIds to get the address from the inboxId
    const inboxState = await client.preferences.inboxStateFromInboxIds([
      message.senderInboxId,
    ]);
    // assuming there is 1 only one identifier
    const addressFromInboxId = inboxState[0].identifiers[0].identifier;

    // INCORRECT:
    const sender = await message.sender();
    const senderAddress = sender.accountIdentifiers[0].identifier;
    ```

16. Remember that ALL conversation types (including DMs) have a members() method. Don't check for "members" in an object:

    ```typescript
    // CORRECT:
    const members = await conversation.members();

    // INCORRECT:
    if (conversation && "members" in conversation) {
      const members = await conversation.members();
    }
    ```

17. Always use toLowerCase() when comparing inboxIds or addresses:

    ```typescript
    // CORRECT:
    if (message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()) {
      continue;
    }

    // INCORRECT:
    if (message.senderInboxId === client.inboxId) {
      continue;
    }
    ```

18. Use consistent error handling pattern with type narrowing for unknown errors:

    ```typescript
    // CORRECT:
    try {
      // code that might throw
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error:", errorMessage);
    }

    // INCORRECT:
    try {
      // code that might throw
    } catch (error) {
      console.error("Error:", error);
    }
    ```

19. Always use the built-in key generation command instead of creating your own script:

    Environment variables

    To run your XMTP agent, you must create a `.env` file with the following variables:

    ```bash
    WALLET_KEY= # the private key of the wallet
    ENCRYPTION_KEY= # encryption key for the local database
    XMTP_ENV=dev # local, dev, production
    ```

    Generating XMTP Keys

    Always use the built-in key generation command instead of creating your own script:

    ```bash
    # Generate generic keys
    yarn gen:keys
    ```

    This command will:

    1. Generate a secure wallet private key
    2. Create an encryption key for the local database
    3. Output the corresponding public key
    4. Automatically append the keys to your `.env` file

    Example output in `.env`:

    ```bash
    # Generic keys
    WALLET_KEY=0x...
    ENCRYPTION_KEY=...
    XMTP_ENV=dev
    # public key is 0x...
    ```

    > [!IMPORTANT]
    > Never create your own key generation script. The built-in command follows security best practices and uses the correct dependencies

## Example: XMTP Group Creator Agent

### Prompt:

"Create an XMTP agent that creates a group for each message received that includes the sender (by inbox ID) and adds this member by address 0x7c40611372d354799d138542e77243c284e460b2. All members should be admins. The group name should be 'New group {message content}' with content being dynamic and the text message itself. After creating the group, it sends a message with the inbox ID, address, and installation ID of each user."

### Solution:

```typescript
import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, IdentifierKind } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

// Define the address to always add to new groups
const MEMBER_ADDRESS = "0x7c40611372d354799d138542e77243c284e460b2";

async function main() {
  // Initialize client
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  // Start listening for messages
  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    try {
      // Get message content and sender inbox ID
      const messageContent = message.content as string;
      console.log(`Received message: ${messageContent}`);
      const senderInboxId = message.senderInboxId;

      // Get the conversation to reply to the sender
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("Could not find the conversation for the message");
        continue;
      }

      // Create a group name based on the message content
      const groupName = `New group ${messageContent}`;

      // Create a new group including the sender and the specified address
      console.log(
        `Creating group "${groupName}" with sender ${senderInboxId}...`,
      );

      // Create group with sender first
      const group = await client.conversations.newGroup([senderInboxId], {
        groupName: groupName,
        groupDescription: "Group created by message agent",
      });

      // Add the specified address as a member
      await group.addMembersByIdentifiers([
        {
          identifier: MEMBER_ADDRESS,
          identifierKind: IdentifierKind.Ethereum,
        },
      ]);

      // Get group members for response
      const members = await group.members();
      const memberDetails = [];

      for (const member of members) {
        let ethAddress = "Unknown";
        const ethIdentifier = member.accountIdentifiers.find(
          (id) => id.identifierKind === IdentifierKind.Ethereum,
        );

        if (ethIdentifier) {
          ethAddress = ethIdentifier.identifier;
        }

        let installationId = "Unknown";
        if (member.installationIds && member.installationIds.length > 0) {
          installationId = member.installationIds[0];
        }

        memberDetails.push({
          inboxId: member.inboxId,
          address: ethAddress,
          installationId: installationId,
        });
      }

      // Make all members admins
      for (const member of members) {
        if (member.inboxId.toLowerCase() !== client.inboxId.toLowerCase()) {
          await group.addAdmin(member.inboxId);
        }
      }

      // Send member details as response in the group
      const responseMessage = `Group created with members:\n${memberDetails
        .map(
          (m) =>
            `- Inbox ID: ${m.inboxId}\n  Address: ${m.address}\n  Installation ID: ${m.installationId}`,
        )
        .join("\n\n")}`;

      await group.send(responseMessage);

      // Reply to original conversation
      await conversation.send(
        `Created group "${groupName}" with you and ${MEMBER_ADDRESS}. All members have admin privileges.`,
      );

      console.log(
        `Group "${groupName}" created successfully with ${members.length} members`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing message:", errorMessage);

      // Try to send an error response
      try {
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );
        if (conversation) {
          await conversation.send(
            "Sorry, I encountered an error creating the group.",
          );
        }
      } catch (sendError) {
        console.error(
          "Failed to send error message:",
          sendError instanceof Error ? sendError.message : String(sendError),
        );
      }
    }
  }
}

main().catch(console.error);
```

## XMTP Helper Functions

```typescript
import { getRandomValues } from "node:crypto";
import { IdentifierKind, type Signer } from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

export const createUser = (key: `0x${string}`): User => {
  const accountKey = key;
  const account = privateKeyToAccount(accountKey);
  return {
    key: accountKey,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
};

export const createSigner = (key: `0x${string}`): Signer => {
  const user = createUser(key);
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifierKind: IdentifierKind.Ethereum,
      identifier: user.account.address.toLowerCase(),
    }),
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        message,
        account: user.account,
      });
      return toBytes(signature);
    },
  };
};

/**
 * Generate a random encryption key
 * @returns The encryption key
 */
export const generateEncryptionKeyHex = () => {
  /* Generate a random encryption key */
  const uint8Array = getRandomValues(new Uint8Array(32));
  /* Convert the encryption key to a hex string */
  return toString(uint8Array, "hex");
};

/**
 * Get the encryption key from a hex string
 * @param hex - The hex string
 * @returns The encryption key
 */
export const getEncryptionKeyFromHex = (hex: string) => {
  /* Convert the hex string to an encryption key */
  return fromString(hex, "hex");
};
```

## XMTP Packages Reference

```tsx
// Client Class
declare class Client {
  constructor(client: Client$1, signer: Signer, codecs: ContentCodec[]);
```

## Consent Best Practices

```tsx
// Only sync conversations with explicit consent
await client.conversations.sync({
  consentState: ConsentState.Allowed,
});

// Filter conversations by consent state
const allowedConversations = await client.conversations.list({
  consentState: ConsentState.Allowed,
});

// Strategic message streaming
const stream = await client.conversations.streamAllMessages();
for await (const message of stream) {
  // Check consent before processing
  const conversation = await client.conversations.getConversationById(
    message.conversationId,
  );
  if (conversation.consentState !== ConsentState.Allowed) continue;

  // Process allowed message
}
```

## XMTP Identifiers Reference

When working with XMTP, you'll encounter several types of identifiers:

### Ethereum Addresses

- Format: `0x` followed by 40 hexadecimal characters
- Example: `0xfb55CB623f2aB58Da17D8696501054a2ACeD1944`
- Usage: Identifies blockchain wallets associated with XMTP users

### Private Key

- Format: `0x` followed by 64 hexadecimal characters
- Example: `0x11567776b95bdbed513330f503741e19877bf7fe73e7957bf6f0ecf3e267fdb8`
- Usage: Used to create the signer for authenticating with XMTP

### Encryption Key

- Format: 64 hexadecimal characters (without "0x" prefix)
- Example: `11973168e34839f9d31749ad77204359c5c39c404e1154eacb7f35a867ee47de`
- Usage: Used for encrypting the local database

### Inbox ID

- Format: 64 hexadecimal characters (without "0x" prefix)
- Example: `1180478fde9f6dfd4559c25f99f1a3f1505e1ad36b9c3a4dd3d5afb68c419179`
- Usage: Primary identifier for XMTP conversations

### Installation ID

- Format: 64 hexadecimal characters (without "0x" prefix)
- Example: `a83166f3ab057f28d634cc04df5587356063dba11bf7d6bcc08b21a8802f4028`
- Usage: Identifies a specific XMTP client installation
- Access via `member.installationIds` array on GroupMember objects

### Example User Credentials Set

```json
{
  "accountAddress": "0xfb55CB623f2aB58Da17D8696501054a2ACeD1944",
  "privateKey": "0x11567776b95bdbed513330f503741e19877bf7fe73e7957bf6f0ecf3e267fdb8",
  "encryptionKey": "11973168e34839f9d31749ad77204359c5c39c404e1154eacb7f35a867ee47de",
  "inboxId": "1180478fde9f6dfd4559c25f99f1a3f1505e1ad36b9c3a4dd3d5afb68c419179",
  "installationId": "a83166f3ab057f28d634cc04df5587356063dba11bf7d6bcc08b21a8802f4028"
}
```

## Working with Members

All conversations, both Groups and DMs, have a members() method that returns an array of GroupMember objects:

```typescript
// Get members from any conversation type (DM or Group)
const members = await conversation.members();

// Find a specific member
const member = members.find(
  (member) => member.inboxId.toLowerCase() === targetInboxId.toLowerCase(),
);

// Get member's Ethereum address
if (member) {
  const ethIdentifier = member.accountIdentifiers.find(
    (id) => id.identifierKind === IdentifierKind.Ethereum,
  );

  if (ethIdentifier) {
    const ethereumAddress = ethIdentifier.identifier;
    console.log(`Found Ethereum address: ${ethereumAddress}`);
  }

  // Get installation ID
  if (member.installationIds.length > 0) {
    const installationId = member.installationIds[0];
    console.log(`Found installation ID: ${installationId}`);
  }
}
```

## Working with Conversations

XMTP provides two main conversation types:

### Direct Messages (DMs)

```typescript
// Create a new DM
const dm = await client.conversations.newDm("inboxId123");

// Or create using an Ethereum address
const dmByAddress = await client.conversations.newDmWithIdentifier({
  identifier: "0x7c40611372d354799d138542e77243c284e460b2",
  identifierKind: IdentifierKind.Ethereum,
});

// Send a message
await dm.send("Hello!");

// Access peer's inbox ID
const peerInboxId = dm.peerInboxId;
```

### Groups

```typescript
// Create a new group
const group = await client.conversations.newGroup(["inboxId1", "inboxId2"], {
  groupName: "My Group",
  groupDescription: "Group description",
});

// Update group metadata
await group.updateName("New Group Name");
await group.updateDescription("Updated description");

// Manage members
await group.addMembers(["newMemberInboxId"]);
await group.removeMembers(["memberToRemoveInboxId"]);

// Manage permissions
await group.addAdmin("memberInboxId");
await group.addSuperAdmin("memberInboxId");
```

## Group Creation Options

When creating a new group, use the correct options interface:

```typescript
export interface CreateGroupOptions {
  permissions?: GroupPermissionsOptions;
  groupName?: string;
  groupImageUrlSquare?: string;
  groupDescription?: string;
  customPermissionPolicySet?: PermissionPolicySet;
  messageDisappearingSettings?: MessageDisappearingSettings;
}
```

Example usage:

```typescript
// Create a group with some initial settings
const group = await client.conversations.newGroup([inboxId1, inboxId2], {
  groupName: "Project Discussion",
  groupDescription: "A group for our project collaboration",
  groupImageUrlSquare: "https://example.com/image.jpg",
});

// Update group settings later
await group.updateName("Updated Project Name");
await group.updateDescription("Our awesome project discussion");
await group.updateImageUrl("https://example.com/new-image.jpg");
```

## Fetching Messages

There are two ways to retrieve messages from conversations:

### 1. Streaming Messages (Recommended for Agents)

Stream all messages to process them in real-time:

```typescript
const stream = await client.conversations.streamAllMessages();
for await (const message of stream) {
  // Process each message as it arrives
  console.log(`Received message: ${message.content as string}`);
}
```

This example implements a retry mechanism with configurable parameters:

```tsx
const MAX_RETRIES = 6; // 6 times
const RETRY_DELAY_MS = 10000; // 10 seconds

// Helper function to pause execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let retryCount = 0;

while (retryCount < MAX_RETRIES) {
  try {
    console.log(
      `Starting message stream... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
    );
    const streamPromise = client.conversations.streamAllMessages();
    const stream = await streamPromise;

    console.log("Waiting for messages...");
    for await (const message of stream) {
      // Process messages here
    }

    // If we get here without an error, reset the retry count
    retryCount = 0;
  } catch (error) {
    retryCount++;
    console.debug(error);
    if (retryCount < MAX_RETRIES) {
      console.log(`Waiting ${RETRY_DELAY_MS / 1000} seconds before retry...`);
      await sleep(RETRY_DELAY_MS);
    } else {
      console.log("Maximum retry attempts reached. Exiting.");
    }
  }
}
```

### 2. Polling Messages

Retrieve all messages at once from the local database:

```typescript
// First sync the conversations from the network to update the local db
await client.conversations.sync();

// Then get all messages as an array
const messages = await conversation.messages();
```

## Key Type References

```tsx
// Client Class
declare class Client {
  constructor(client: Client$1, signer: Signer, codecs: ContentCodec[]);
  static create(
    signer: Signer,
    encryptionKey: Uint8Array,
    options?: ClientOptions,
  ): Promise<Client>;
  get inboxId(): string;
  get installationId(): string;
  get conversations(): Conversations;
  get preferences(): Preferences;
}

// Conversations Class
declare class Conversations {
  constructor(client: Client, conversations: Conversations$1);
  getConversationById(id: string): Promise<Dm | Group | undefined>;
  newGroupWithIdentifiers(
    identifiers: Identifier[],
    options?: CreateGroupOptions,
  ): Promise<Group>;
  newGroup(inboxIds: string[], options?: CreateGroupOptions): Promise<Group>;
  newDmWithIdentifier(
    identifier: Identifier,
    options?: CreateDmOptions,
  ): Promise<Dm>;
  newDm(inboxId: string, options?: CreateDmOptions): Promise<Dm>;
  sync(): Promise<void>;
  streamAllMessages(
    callback?: StreamCallback<DecodedMessage>,
  ): Promise<AsyncStream<DecodedMessage<any>>>;
}

// Conversation Base Class
declare class Conversation {
  client: Client;
  constructor(
    client: Client,
    conversation: Conversation$1,
    lastMessage?: Message | null,
  );
  get id(): string;
  send<T>(content: T, options?: SendOptions): Promise<string>;
  messages<T>(options?: PaginationOptions): Promise<Array<DecodedMessage<T>>>;
  members(): Promise<GroupMember[]>;
}

// Dm Class
declare class Dm extends Conversation {
  constructor(
    client: Client,
    conversation: Conversation$1,
    lastMessage?: Message | null,
  );
  get peerInboxId(): string;
}

// Group Class
declare class Group extends Conversation {
  constructor(
    client: Client,
    conversation: Conversation$1,
    lastMessage?: Message | null,
  );
  get name(): string;
  updateName(name: string): Promise<void>;
  get imageUrl(): string;
  updateImageUrl(imageUrl: string): Promise<void>;
  get description(): string;
  updateDescription(description: string): Promise<void>;
  get admins(): string[];
  get superAdmins(): string[];
  isAdmin(inboxId: string): boolean;
  isSuperAdmin(inboxId: string): boolean;
  addMembersByIdentifiers(identifiers: Identifier[]): Promise<void>;
  addMembers(inboxIds: string[]): Promise<void>;
  removeMembers(inboxIds: string[]): Promise<void>;
  addAdmin(inboxId: string): Promise<void>;
  removeAdmin(inboxId: string): Promise<void>;
  addSuperAdmin(inboxId: string): Promise<void>;
  removeSuperAdmin(inboxId: string): Promise<void>;
}

// GroupMember Class
declare class GroupMember {
  inboxId: string;
  accountIdentifiers: Array<Identifier>;
  installationIds: Array<string>;
  permissionLevel: PermissionLevel;
  consentState: ConsentState;
}

// DecodedMessage Class
declare class DecodedMessage<T = any> {
  content: T;
  contentType: ContentTypeId | undefined;
  conversationId: string;
  id: string;
  senderInboxId: string;
  sentAt: Date;
  constructor(client: Client, message: Message);
}

// Identifier Interface
export interface Identifier {
  identifier: string;
  identifierKind: IdentifierKind;
}

export declare const enum IdentifierKind {
  Ethereum = 0,
  Passkey = 1,
}

// CreateGroupOptions Interface
export interface CreateGroupOptions {
  groupName?: string;
  groupImageUrlSquare?: string;
  groupDescription?: string;
}
```

### Common Usage Patterns

When working with these classes:

1. **Client**

   - Gateway to all XMTP functionality
   - Contains the conversations, contacts, and content types registries

2. **Conversations**

   - Central interface for managing all conversations
   - Use `sync()` before accessing local conversation data
   - Use `streamAllMessages()` to listen for new messages in real-time
   - Create conversations with `newDm()`, `newGroup()`, etc.

3. **Dm**

   - Access the peer using `conversation.peerInboxId`
   - Create new DMs with `client.conversations.newDm(inboxId)`
   - Send messages with `dm.send(content)`

4. **Group**

   - Get members with `await group.members();` (this works for DMs too)
   - Manage group metadata with `updateName()`, `updateDescription()`, etc.
   - Add/remove members with `addMembers()` and `removeMembers()`
   - Manage permissions with admin methods: `addAdmin()`, `addSuperAdmin()`, etc.
   - Check permissions with `isAdmin()` and `isSuperAdmin()`

5. **GroupMember**
   - Use `member.inboxId` to identify members
   - Access Ethereum addresses through `member.accountIdentifiers`
   - Access installation IDs through `member.installationIds`
   - Check permission level with `member.permissionLevel`
   - Verify consent state with `member.consentState`

## Other Notes

### Handling local database paths

If no `dbPath` is provided, the client will use the current working directory. You can also specify a custom path for the database.

```jsx
export const getDbPath = (description: string = "xmtp") => {
  //Checks if the environment is a Railway deployment
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  // Create database directory if it doesn't exist
  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }
  return `${volumePath}/${description}.db3`;
};

// Create a client with db path
const signerIdentifier = (await signer.getIdentifier()).identifier;
const client = await Client.create(signer, {
  dbEncryptionKey,
  env: XMTP_ENV as XmtpEnv,
  dbPath:getDbPath(XMTP_ENV+"-"+signerIdentifier),
});
```
