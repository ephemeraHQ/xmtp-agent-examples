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

  // Stream all messages for markdown processing
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
          client.inboxId.toLowerCase()
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

          // Check if it's a markdown message
          if (message.contentType?.typeId === "markdown") {
            console.log(`📝 Received markdown message from ${addressFromInboxId}:`);
            console.log("Raw markdown content:", message.content);
            
            // Send a markdown response
            const markdownResponse = `# Hello from XMTP Markdown Agent! 🤖

Thank you for your **markdown** message!

## Your Message Analysis:
- Sender: \`${addressFromInboxId}\`
- Content Type: **${message.contentType?.typeId}**
- Length: ${(message.content as string).length} characters

### Markdown Features Detected:
${analyzeMarkdownFeatures(message.content as string)}

---

*This is an automated response demonstrating XMTP markdown content type support.*

\`\`\`typescript
// Example: How to send markdown with XMTP
await conversation.send(markdownContent, {
  contentType: MarkdownCodec.contentType
});
\`\`\`

> 💡 **Tip**: Try sending messages with headers, lists, code blocks, or emphasis!`;

            await conversation.send(markdownResponse, ContentTypeMarkdown);
            
            console.log(`✅ Sent markdown response to ${addressFromInboxId}`);
            
          } else if (message.contentType?.typeId === "text") {
            // Handle plain text messages and encourage markdown usage
            const textContent = message.content as string;
            console.log(`💬 Received text message from ${addressFromInboxId}: "${textContent}"`);
            
            // Check if the text contains markdown-like patterns
            const hasMarkdownPatterns = checkForMarkdownPatterns(textContent);
            
            if (hasMarkdownPatterns) {
              const response = `# I noticed some markdown-like formatting! 📝

Your message: "${textContent}"

Would you like to try sending this as **actual markdown**? Here's your message converted:

${convertTextToMarkdown(textContent)}

---

*Send me messages with markdown content type to see enhanced formatting and analysis!*`;

              await conversation.send(response, ContentTypeMarkdown);
            } else {
              // Send a simple markdown introduction
              const introResponse = `# Welcome to XMTP Markdown Demo! 🎯

You sent: "${textContent}"

## Try sending markdown messages! 

Here are some examples you can try:

### Headers
\`\`\`markdown
# This is a header
## This is a subheader
\`\`\`

### Emphasis
\`\`\`markdown
**bold text** and *italic text*
\`\`\`

### Lists
\`\`\`markdown
- Item 1
- Item 2
- Item 3
\`\`\`

### Code
\`\`\`markdown
\`inline code\` or code blocks:
\`\`\`javascript
console.log("Hello, XMTP!");
\`\`\`
\`\`\`

---

*Send your next message using the markdown content type to see the full analysis!* ✨`;

              await conversation.send(introResponse, ContentTypeMarkdown);
            }
            
            console.log(`✅ Sent markdown introduction to ${addressFromInboxId}`);
          } else {
            console.log(`❓ Received unsupported content type: ${message.contentType?.typeId}`);
          }
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

/**
 * Analyze markdown features in the content
 */
function analyzeMarkdownFeatures(content: string): string {
  const features: string[] = [];
  
  // Check for headers
  if (content.includes("#")) {
    const headerMatches = content.match(/^#{1,6}\s/gm);
    if (headerMatches) {
      features.push(`📋 **Headers**: ${headerMatches.length} found`);
    }
  }
  
  // Check for emphasis
  if (content.includes("**") || content.includes("*")) {
    features.push("💪 **Emphasis**: Bold/italic text detected");
  }
  
  // Check for code
  if (content.includes("`")) {
    if (content.includes("```")) {
      features.push("📦 **Code Blocks**: Multi-line code detected");
    } else {
      features.push("💻 **Inline Code**: Code snippets detected");
    }
  }
  
  // Check for lists
  if (content.match(/^[\s]*[-*+]\s/gm) || content.match(/^[\s]*\d+\.\s/gm)) {
    features.push("📝 **Lists**: Bullet or numbered lists detected");
  }
  
  // Check for links
  if (content.includes("[") && content.includes("]") && content.includes("(")) {
    features.push("🔗 **Links**: Hyperlinks detected");
  }
  
  // Check for blockquotes
  if (content.includes(">")) {
    features.push("💬 **Blockquotes**: Quoted text detected");
  }
  
  // Check for horizontal rules
  if (content.includes("---") || content.includes("***")) {
    features.push("➖ **Horizontal Rules**: Section dividers detected");
  }
  
  if (features.length === 0) {
    return "- No special markdown features detected (plain text content)";
  }
  
  return features.map(feature => `- ${feature}`).join("\n");
}

/**
 * Check if text contains markdown-like patterns
 */
function checkForMarkdownPatterns(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/, // Headers
    /\*\*.*\*\*/, // Bold
    /\*.*\*/, // Italic (but not bold)
    /`.*`/, // Inline code
    /```/, // Code blocks
    /^[\s]*[-*+]\s/m, // Bullet lists
    /^[\s]*\d+\.\s/m, // Numbered lists
    /\[.*\]\(.*\)/, // Links
    /^>/m, // Blockquotes
    /^---/m, // Horizontal rules
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Convert plain text with markdown patterns to proper markdown
 */
function convertTextToMarkdown(text: string): string {
  // This is a simple example - in practice you might want more sophisticated conversion
  let converted = text;
  
  // Add markdown formatting if patterns are detected
  if (checkForMarkdownPatterns(text)) {
    converted = `\`\`\`markdown\n${text}\n\`\`\``;
  }
  
  return converted;
}

main().catch(console.error);