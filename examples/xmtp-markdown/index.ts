import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
  validateEnvironment,
} from "@helpers/client";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { MarkdownCodec, ContentTypeMarkdown } from "@xmtp/content-type-markdown";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

async function main() {
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
    // Register the markdown codec with the client
    codecs: [new MarkdownCodec()],
  });
  
  void logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  // Stream all messages
  const messageStream = () => {
    console.log("Waiting for messages...");
    void client.conversations.streamAllMessages((error, message) => {
      if (error) {
        console.error("Error in message stream:", error);
        return;
      }
      if (!message) {
        console.log("No message received");
        return;
      }

      void (async () => {
        // Ignore messages from the same agent
        if (
          message.senderInboxId.toLowerCase() ===
          client.inboxId.toLowerCase() ||
          message.contentType?.typeId !== "text"
        ) {
          return;
        }

        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (!conversation) {
          console.log("Unable to find conversation, skipping");
          return;
        }

        try {
          const inboxState = await client.preferences.inboxStateFromInboxIds([
            message.senderInboxId,
          ]);
          const addressFromInboxId = inboxState[0].identifiers[0].identifier;
          console.log(`Sending markdown example to ${addressFromInboxId}...`);

          // Send a markdown example
          const markdownExample = `# Hello from XMTP! 🤖

This is a **markdown** message example.

## Features demonstrated:

- **Bold text** and *italic text*
- \`Inline code\`
- [Links](https://xmtp.org)

### Code block:
\`\`\`javascript
console.log("Hello XMTP with markdown!");
\`\`\`

> This is a blockquote showing markdown formatting.

---

*Message sent using @xmtp/content-type-markdown*`;

          await conversation.send(markdownExample, ContentTypeMarkdown);
          console.log(`✅ Sent markdown example to ${addressFromInboxId}`);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Error processing message:", errorMessage);
        }
      })();
    });
  };

  // Start the message stream
  messageStream();
}

main().catch(console.error);