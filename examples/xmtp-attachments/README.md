# Image attachment example

This agent replies with an image attachment.

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)
- [Pinata API key](https://app.pinata.cloud/developers/api-keys)
- [@xmtp/content-type-remote-attachment](https://docs.xmtp.org/inboxes/content-types/attachments#receive-encrypted-file)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production

# Pinata
PINATA_API_KEY= # the API key for the Pinata service
PINATA_SECRET_KEY= # the secret key for the Pinata service
```

You can generate random xmtp keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

## Send encrypted file

```tsx
const blob = new Blob([file], { type: extname });
let imgArray = new Uint8Array(await blob.arrayBuffer());

const attachment = {
  filename: filename,
  mimeType: extname, //image, video or audio
  data: imgArray,
};

console.log("Attachment created", attachment);
await conversation.send(attachment, { contentType: ContentTypeAttachment });
```

```javascript
// Receive encrypted file
if (message.contentType.sameAs(ContentTypeAttachment)) {
  const blobdecoded = new Blob([message.content.data], {
    type: message.content.mimeType,
  });
  const url = URL.createObjectURL(blobdecoded);
}
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
