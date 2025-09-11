# Remote Attachment Utilities

This example demonstrates how to use the encapsulated remote attachment utilities that separate the encoding/decoding logic from the upload mechanism.

## Usage

### Basic Setup

```typescript
import {
  createRemoteAttachmentFromData,
  createRemoteAttachmentFromFile,
  loadRemoteAttachment,
  type UploadFunction,
} from "./attachmentUtils";
import { uploadToPinata } from "./upload"; // Your upload function

// Configure your upload function
const uploadFunction: UploadFunction = uploadToPinata;
```

### Creating Remote Attachments

**From a file:**

```typescript
const remoteAttachment = await createRemoteAttachmentFromFile(
  "./path/to/file.png",
  { uploadFn: uploadFunction },
);
```

**From raw data:**

```typescript
const data = new Uint8Array([...]); // Your file data
const remoteAttachment = await createRemoteAttachmentFromData(
  data,
  "filename.png",
  "image/png",
  { uploadFn: uploadFunction }
);
```

### Loading Remote Attachments

```typescript
const attachment = await loadRemoteAttachment(remoteAttachment, client);
console.log(`Loaded: ${attachment.filename}`);
console.log(`Size: ${attachment.data.byteLength} bytes`);
```

## Custom Upload Functions

You can easily replace the upload mechanism by providing your own upload function:

```typescript
// Example: Upload to AWS S3
const uploadToS3: UploadFunction = async (encryptedData, filename) => {
  // Your S3 upload logic here
  const result = await s3
    .upload({
      Bucket: "my-bucket",
      Key: filename,
      Body: encryptedData,
    })
    .promise();

  return result.Location;
};

// Use with the utilities
const remoteAttachment = await createRemoteAttachmentFromFile("./file.png", {
  uploadFn: uploadToS3,
});
```

## Key Benefits

1. **Separation of Concerns**: Upload logic is separate from encoding/decoding
2. **Flexibility**: Easy to swap upload providers (Pinata, S3, IPFS, etc.)
3. **Reusability**: Clean utility functions for common operations
4. **Type Safety**: Full TypeScript support with proper types
