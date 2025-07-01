# XMTP Markdown Agent

This example demonstrates how to use the `@xmtp/content-type-markdown` package to send and receive markdown-formatted messages with XMTP.

## Features

- 📝 **Markdown Support**: Send and receive rich markdown content
- 🔍 **Content Analysis**: Automatically analyzes markdown features in received messages
- 🎯 **Pattern Detection**: Detects markdown-like patterns in plain text messages
- 🤖 **Interactive Responses**: Provides educational responses about markdown usage
- ✨ **Rich Formatting**: Demonstrates headers, emphasis, code blocks, lists, and more

## What this agent does

1. **Receives Markdown Messages**: When you send a markdown message, the agent analyzes its features and responds with a detailed breakdown
2. **Handles Plain Text**: For plain text messages, it provides an introduction to markdown and examples
3. **Pattern Recognition**: Detects when plain text contains markdown-like formatting and suggests improvements
4. **Educational Responses**: Teaches users about markdown features through interactive examples

## Setup

1. **Install dependencies**:
   ```bash
   yarn install
   ```

2. **Generate keys**:
   ```bash
   yarn gen:keys
   ```

3. **Set environment variables**:
   Copy `.env.example` to `.env` and update with your generated keys:
   ```bash
   cp .env.example .env
   ```

## Running the agent

### Quick demo (no setup required):
```bash
yarn demo
```
This runs a simple demonstration of the markdown content type encoding/decoding without requiring XMTP client setup.

### Development mode (with hot-reloading):
```bash
yarn dev
```

### Production mode:
```bash
yarn start
```

## Usage

1. Start the agent with `yarn dev` or `yarn start`
2. Send messages to the agent's address
3. Try different types of content:

### Send Markdown Messages
Send messages using the markdown content type with features like:

- **Headers**: `# Main Title`, `## Subtitle`
- **Emphasis**: `**bold**`, `*italic*`
- **Code**: `` `inline code` `` or code blocks
- **Lists**: Bullet points or numbered lists
- **Links**: `[text](url)`
- **Blockquotes**: `> quoted text`

### Send Plain Text
Send regular text messages to get:
- An introduction to markdown
- Examples of markdown syntax
- Suggestions for converting your text to markdown

## Example Interactions

### Markdown Message Input:
```markdown
# Hello Agent!

This is a **markdown** message with:
- A header
- Some *emphasis*
- A list item

\`\`\`javascript
console.log("And some code!");
\`\`\`
```

### Agent Response:
The agent will analyze your markdown and respond with:
- Feature detection (headers, emphasis, code, lists, etc.)
- Message metadata (sender, content type, length)
- Tips and examples for more markdown usage

### Plain Text Input:
```
Hello, I want to learn about markdown!
```

### Agent Response:
The agent provides a comprehensive markdown tutorial with examples and syntax guides.

## Markdown Content Type

This example uses the `@xmtp/content-type-markdown` package which:

- Enables sending and receiving markdown-formatted messages
- Preserves markdown syntax and formatting
- Allows for rich text communication between XMTP clients
- Is compatible with other XMTP SDKs that support the markdown content type

## Key Features Demonstrated

1. **Codec Registration**: Shows how to register the `MarkdownCodec` with the XMTP client
2. **Content Type Detection**: Distinguishes between markdown and text messages
3. **Markdown Analysis**: Parses markdown content to identify features
4. **Rich Responses**: Sends formatted markdown responses with examples
5. **Educational Content**: Provides interactive learning about markdown syntax

## Technical Implementation

- Uses `@xmtp/content-type-markdown` for markdown support
- Implements pattern recognition for markdown syntax
- Provides detailed content analysis
- Demonstrates best practices for content type handling
- Shows how to send messages with specific content types

## Learn More

- [XMTP Documentation](https://docs.xmtp.org/)
- [Markdown Content Type](https://github.com/xmtp/xmtp-js-content-types)
- [XMTP Node SDK](https://github.com/xmtp/xmtp-node-js-sdk)