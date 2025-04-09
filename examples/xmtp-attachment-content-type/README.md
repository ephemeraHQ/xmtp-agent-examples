# XMTP Attachment Agent

This example demonstrates how to send file attachments with XMTP messages using the Remote Attachment content type. Files are first uploaded to ImgBB (a free image hosting service) before being sent as XMTP attachments.

## Features

- Sends image files in response to text messages
- Uploads files to ImgBB before sending
- Handles encryption/decryption of file contents
- Example code showing how to implement file uploads in browser environments

## Setup

1. Install dependencies:

```bash
npm install
```

2. Generate XMTP keys:

```bash
npm run gen:keys
```

3. Create a free account on [ImgBB](https://imgbb.com/) and get an API key

4. Add the ImgBB API key to your `.env` file:

```
IMGBB_API_KEY=your_imgbb_api_key
```

Your `.env` file should contain:

```
WALLET_KEY=your_wallet_private_key
ENCRYPTION_KEY=your_encryption_key
XMTP_ENV=dev
IMGBB_API_KEY=your_imgbb_api_key
```

## Usage

1. Place an image file named `logo.png` in the project root or update the `DEFAULT_IMAGE_PATH` constant

2. Run the agent:

```bash
npm start
```

The agent will respond to any received text message by uploading and sending an image file as an attachment.

## Implementing in Web Apps

To implement file uploads in a web application, you can use the following pattern:

```javascript
// When handling a file upload in a browser (e.g., from a file input)
async function handleFileUploadInBrowser(file, xmtpClient, conversation) {
  try {
    // Convert File to ArrayBuffer using FileReader
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsArrayBuffer(file);
    });

    // Create Uint8Array from the array buffer
    const fileData = new Uint8Array(arrayBuffer);

    // 1. Upload the file to a hosting service
    const formData = new FormData();
    formData.append("image", new Blob([fileData]), file.name);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
      },
    );

    const result = await response.json();
    const fileUrl = result.data.url;

    // 2. Create attachment object
    const attachment = {
      filename: file.name,
      mimeType: file.type,
      data: fileData,
    };

    // 3. Encrypt the attachment
    const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
      attachment,
      new AttachmentCodec(),
    );

    // 4. Create a remote attachment
    const remoteAttachment = {
      url: fileUrl,
      contentDigest: encryptedEncoded.digest,
      salt: encryptedEncoded.salt,
      nonce: encryptedEncoded.nonce,
      secret: encryptedEncoded.secret,
      scheme: "https",
      filename: attachment.filename,
      contentLength: attachment.data.byteLength,
    };

    // 5. Send the remote attachment
    await conversation.send(remoteAttachment, ContentTypeRemoteAttachment);
    console.log("File attachment sent successfully");
  } catch (error) {
    console.error("Error handling file upload:", error);
  }
}
```

## Notes

- ImgBB is used as an example hosting service. In production, you might want to use a more robust solution like AWS S3 or similar.
- The agent will only respond to text messages and ignores other content types.
- Make sure your ImgBB API key has sufficient privileges for uploading files.
