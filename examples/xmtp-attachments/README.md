# XMTP attachments example

This XMTP agent receives attachments and sends them back after decoding and re-encoding them.

## How it works

1. **Receiving Attachments**: When someone sends an attachment, the agent:
   - Decodes the received attachment using `RemoteAttachmentCodec.load()`
   - Extracts the file data, filename, and MIME type
   - Re-encodes the attachment with new encryption keys
   - Uploads it to IPFS via Pinata
   - Sends the re-encoded attachment back to the sender

2. **Receiving Text**: When someone sends a text message, the agent:
   - Sends back the default logo.png attachment

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
cd examples/xmtp-attachments
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
