# XMTP Attachments Example

An XMTP agent that demonstrates file attachment handling using utility functions for encryption, decoding, and re-encoding.

## Features

- **Attachment Processing**: Receives, decodes, and re-encodes file attachments
- **Encryption Utilities**: Uses utility functions for secure file handling
- **IPFS Integration**: Uploads files to Pinata for decentralized storage
- **Multi-format Support**: Handles various file types and MIME types
- **Automatic Responses**: Sends default attachment for text messages

## How it works

### 1. Receiving Attachments

When someone sends an attachment, the agent:

- Decodes the received attachment using the `loadRemoteAttachment` utility
- Extracts the file data, filename, and MIME type
- Re-encrypts the attachment with new keys using `encryptAttachment` utility
- Uploads it to IPFS via Pinata
- Creates a new remote attachment using `createRemoteAttachmentFromData` utility
- Sends the re-encoded attachment back to the sender

### 2. Receiving Text Messages

When someone sends a text message, the agent:

- Encrypts the default logo.png using the `encryptAttachment` utility
- Creates a remote attachment using `createRemoteAttachmentFromFile` utility
- Sends the attachment back to the user

## Technical Implementation

### Utility Functions Usage

The agent leverages attachment utilities from `../../utils/atttachment.ts`:

```typescript
import {
  createRemoteAttachmentFromData,
  createRemoteAttachmentFromFile,
  encryptAttachment,
  loadRemoteAttachment,
} from "../../utils/atttachment";

// For text messages - send default attachment
const encrypted = await encryptAttachment(
  new Uint8Array(await readFile(DEFAULT_IMAGE_PATH)),
  "logo.png",
  "image/png",
);

const remoteAttachment = await createRemoteAttachmentFromFile(
  DEFAULT_IMAGE_PATH,
  fileUrl,
  "image/png",
);

// For received attachments - decode and re-encode
const receivedAttachment = await loadRemoteAttachment(
  ctx.message.content,
  agent.client,
);

const reEncodedAttachment = await createRemoteAttachmentFromData(
  receivedAttachment.data,
  filename,
  mimeType,
  fileUrl,
);
```

### Attachment Processing Flow

```typescript
// Handle incoming attachments
agent.on("attachment", async (ctx) => {
  // 1. Load and decode the received attachment
  const receivedAttachment = await loadRemoteAttachment(
    ctx.message.content,
    agent.client,
  );

  // 2. Extract file information
  const filename = receivedAttachment.filename || "unnamed";
  const mimeType = receivedAttachment.mimeType || "application/octet-stream";

  // 3. Re-encrypt the attachment data
  const encrypted = await encryptAttachment(
    receivedAttachment.data,
    filename,
    mimeType,
  );

  // 4. Upload to IPFS
  const fileUrl = await uploadToPinata(
    encrypted.encryptedData,
    encrypted.filename,
  );

  // 5. Create and send new remote attachment
  const reEncodedAttachment = await createRemoteAttachmentFromData(
    receivedAttachment.data,
    filename,
    mimeType,
    fileUrl,
  );

  await ctx.sendText(reEncodedAttachment, ContentTypeRemoteAttachment);
});
```

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
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # encryption key for the local database
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
