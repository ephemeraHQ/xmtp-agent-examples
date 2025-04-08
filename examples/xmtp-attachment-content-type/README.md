# GM agent

This agent replies `gm`

![](./screenshot.png)

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
cd examples/xmtp-gm
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Usage

### Import the content type

```tsx
import {
  AttachmentCodec,
  ContentTypeAttachment,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
```

### Register the codec

```tsx
const client = await Client.create(signer, encryptionKey, {
  codecs: [new RemoteAttachmentCodec(), new AttachmentCodec()],
});
```

### Send an image

```tsx
let imgArray: Uint8Array;
let mimeType: string;
let filename: string;

const MAX_SIZE = 1024 * 1024; // 1MB in bytes

  const file = await readFile(source);

  // Check file size
  if (file.length > MAX_SIZE) {
    throw new Error("Image size exceeds 1MB limit");
  }

  filename = path.basename(source);
  const extname = path.extname(source);
  mimeType = `image/${extname.replace(".", "").replace("jpg", "jpeg")}`;
  imgArray = new Uint8Array(file);
}

const attachment: Attachment = {
  filename,
  mimeType,
  data: imgArray,
};
await conversation.send(attachment, ContentTypeAttachment);
```
