# XMTP Markdown Agent

This agent demonstrates how to use the `@xmtp/content-type-markdown` package to send and receive markdown-formatted messages with XMTP.

## Features

- 📝 **Receives markdown messages**: Analyzes and responds to markdown content with feature breakdown
- 💬 **Handles plain text**: Provides markdown tutorials and examples for text messages  
- 🔍 **Pattern detection**: Identifies markdown-like patterns in text and suggests improvements
- 📚 **Educational responses**: Teaches users markdown syntax through interactive examples

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

You can generate random xmtp keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

### Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/xmtp-markdown
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## What the agent does

1. **For markdown messages**: Analyzes the content and responds with a detailed breakdown of markdown features detected
2. **For plain text**: Provides an introduction to markdown with examples and syntax guides
3. **Pattern recognition**: Detects when text contains markdown-like formatting and suggests using the markdown content type

## Example interactions

Send the agent a markdown message like:

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

The agent will analyze your markdown and respond with feature detection, message metadata, and tips for more markdown usage.