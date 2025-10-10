# XMTP Attachments Example

An XMTP agent that demonstrates [file attachment](https://docs.xmtp.org/agents/content-types/attachments) handling using utility functions for encryption, decoding, and re-encoding.

<p align="center" >
  <img src="media/left.png" alt="Image 1" width="49%">
</p>

## Usage

```typescript
// 1. Encrypt the attachment data
const encrypted = await encryptAttachment(
  new Uint8Array(await readFile(DEFAULT_IMAGE_PATH)),
  "logo.png",
  "image/png",
);

// 2. Upload to IPFS
const fileUrl = await uploadToPinata(
  encrypted.encryptedData,
  encrypted.filename,
);

// 3. Create and send new remote attachment
const remoteAttachment = await createRemoteAttachmentFromFile(
  DEFAULT_IMAGE_PATH,
  fileUrl,
  "image/png",
);

// 4. Send the remote attachment
await ctx.conversation.send(remoteAttachment, ContentTypeRemoteAttachment);
```

## Getting started

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

# Pinata API Key
PINATA_API_KEY= # the API key for the Pinata service
PINATA_SECRET_KEY= # the secret key for the Pinata service
```

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
