# XMTP Attachment Echo Agent

This XMTP agent receives attachments and sends them back after decoding and re-encoding them.

## Features

- **Attachment Echo**: Receives any attachment and sends it back to the sender
- **Text Response**: Sends a default logo.png attachment when receiving text messages
- **Error Handling**: Graceful error handling with user-friendly messages

## How it works

1. **Receiving Attachments**: When someone sends an attachment, the agent:
   - Decodes the received attachment using `RemoteAttachmentCodec.load()`
   - Extracts the file data, filename, and MIME type
   - Re-encodes the attachment with new encryption keys
   - Uploads it to IPFS via Pinata
   - Sends the re-encoded attachment back to the sender

2. **Receiving Text**: When someone sends a text message, the agent:
   - Sends back the default logo.png attachment

## Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Set up environment variables in `.env`:

   ```bash
   WALLET_KEY=your_private_key_here
   ENCRYPTION_KEY=your_encryption_key_here
   XMTP_ENV=dev
   PINATA_API_KEY=your_pinata_api_key
   PINATA_SECRET_KEY=your_pinata_secret_key
   ```

3. Generate keys if needed:

   ```bash
   yarn gen:keys
   ```

4. Start the agent:
   ```bash
   yarn dev
   ```

## Usage

- Send any attachment to the agent and it will echo it back
- Send a text message to receive the default logo.png attachment

## Requirements

- Node.js v20+
- Pinata API credentials for IPFS uploads
- XMTP wallet with private key
