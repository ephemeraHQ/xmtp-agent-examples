import { MarkdownCodec, ContentTypeMarkdown } from "@xmtp/content-type-markdown";

/**
 * Demo script showing how to use the XMTP Markdown Content Type
 * This demonstrates the encoding/decoding process without requiring a full XMTP client setup
 */

// Sample markdown content
const markdownContent = `# Hello XMTP! 🚀

Welcome to the **XMTP Markdown Content Type** demo!

## Features

This content type supports:

- **Headers** like this one
- **Bold** and *italic* text
- \`Inline code\` snippets
- Code blocks:

\`\`\`typescript
const example = "Hello, World!";
console.log(example);
\`\`\`

- [Links](https://xmtp.org)
- Lists (like this one!)

### Blockquotes

> This is a blockquote that demonstrates
> how markdown formatting is preserved
> in XMTP messages.

---

*Try sending messages like this using the XMTP Markdown Agent!*`;

async function demonstrateMarkdownCodec() {
  console.log("🎯 XMTP Markdown Content Type Demo\n");
  
  // Create a codec instance
  const codec = new MarkdownCodec();
  
  console.log("📝 Original markdown content:");
  console.log("---");
  console.log(markdownContent);
  console.log("---\n");
  
  // Encode the content
  console.log("🔄 Encoding markdown content...");
  const encoded = codec.encode(markdownContent);
  
  console.log("✅ Encoded content:");
  console.log(`- Content Type: ${encoded.type.authorityId}/${encoded.type.typeId}:${encoded.type.versionMajor}.${encoded.type.versionMinor}`);
  console.log(`- Parameters:`, encoded.parameters);
  console.log(`- Content size: ${encoded.content.byteLength} bytes`);
  console.log(`- Content Type ID matches: ${encoded.type.sameAs(ContentTypeMarkdown)}\n`);
  
  // Decode the content
  console.log("🔄 Decoding content...");
  const decoded = codec.decode(encoded);
  
  console.log("✅ Decoded content:");
  console.log("---");
  console.log(decoded);
  console.log("---\n");
  
  // Verify the round-trip
  const isIdentical = decoded === markdownContent;
  console.log(`🔍 Round-trip verification: ${isIdentical ? "✅ SUCCESS" : "❌ FAILED"}`);
  
  if (isIdentical) {
    console.log("🎉 The markdown content was perfectly preserved through encoding/decoding!");
  }
  
  console.log("\n📚 Next steps:");
  console.log("- Use this content type in your XMTP client by registering the MarkdownCodec");
  console.log("- Send messages with ContentTypeMarkdown as the content type");
  console.log("- Build rich messaging experiences with formatted text");
  console.log("\n🚀 Run the main agent with 'yarn start' to see it in action!");
}

// Run the demo
demonstrateMarkdownCodec().catch(console.error);