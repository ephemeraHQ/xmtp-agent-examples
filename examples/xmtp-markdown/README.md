# XMTP Markdown Agent

This agent demonstrates how to use the `@xmtp/content-type-markdown` package to send markdown-formatted messages with XMTP.

## What it does

Sends a markdown example message to anyone who messages the agent.

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

## Example response

The agent sends back a markdown message like:

```markdown
# Hello from XMTP! 🤖

This is a **markdown** message example.

## Features demonstrated:

- **Bold text** and *italic text*
- `Inline code`
- [Links](https://xmtp.org)

### Code block:
```javascript
console.log("Hello XMTP with markdown!");
```

> This is a blockquote showing markdown formatting.

---

*Message sent using @xmtp/content-type-markdown*
```