import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
  type Attachment,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";

/**
 * Result of encrypting an attachment, ready for upload
 */
export interface EncryptedAttachment {
  /** Encrypted file data ready for upload */
  encryptedData: Uint8Array;
  /** Original filename */
  filename: string;
  /** Encryption metadata needed to create the RemoteAttachment */
  metadata: {
    contentDigest: Uint8Array;
    salt: Uint8Array;
    nonce: Uint8Array;
    secret: Uint8Array;
    contentLength: number;
  };
}

/**
 * Encrypts an attachment and returns the encrypted data for upload
 * @param data - File data as Uint8Array
 * @param filename - Name of the file
 * @param mimeType - MIME type of the file
 * @returns EncryptedAttachment with data ready for upload
 */
export async function encryptAttachment(
  data: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<EncryptedAttachment> {
  const attachment: Attachment = {
    filename,
    mimeType,
    data,
  };

  const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
    attachment,
    new AttachmentCodec(),
  );

  return {
    encryptedData: encryptedEncoded.payload,
    filename: attachment.filename,
    metadata: {
      contentDigest: encryptedEncoded.digest,
      salt: encryptedEncoded.salt,
      nonce: encryptedEncoded.nonce,
      secret: encryptedEncoded.secret,
      contentLength: attachment.data.byteLength,
    },
  };
}

/**
 * Creates a remote attachment from a file path
 * @param filePath - Path to the file to attach
 * @param fileUrl - URL where the encrypted file will be accessible
 * @returns RemoteAttachment object ready to be sent
 */
export async function createRemoteAttachmentFromFile(
  filePath: string,
  fileUrl: string,
): Promise<RemoteAttachment> {
  // Log the full path of the file
  const fullPath = path.resolve(filePath);
  console.log(`Creating remote attachment from: ${fullPath}`);

  const fileData = await readFile(filePath);
  const filename = path.basename(filePath);

  // Simple MIME type detection (can be extended as needed)
  const mimeType = getMimeType(filename);

  return createRemoteAttachmentFromData(
    new Uint8Array(fileData),
    filename,
    mimeType,
    fileUrl,
  );
}

/**
 * Creates a remote attachment from raw data
 * @param data - File data as Uint8Array
 * @param filename - Name of the file
 * @param mimeType - MIME type of the file
 * @param fileUrl - URL where the encrypted file will be accessible
 * @returns RemoteAttachment object ready to be sent
 */
export async function createRemoteAttachmentFromData(
  data: Uint8Array,
  filename: string,
  mimeType: string,
  fileUrl: string,
): Promise<RemoteAttachment> {
  const attachment: Attachment = {
    filename,
    mimeType,
    data,
  };

  // Encrypt and encode the attachment
  const encryptedEncoded = await RemoteAttachmentCodec.encodeEncrypted(
    attachment,
    new AttachmentCodec(),
  );

  const scheme = `${new URL(fileUrl).protocol}//`;

  return {
    url: fileUrl,
    contentDigest: encryptedEncoded.digest,
    salt: encryptedEncoded.salt,
    nonce: encryptedEncoded.nonce,
    secret: encryptedEncoded.secret,
    scheme: scheme,
    filename: attachment.filename,
    contentLength: attachment.data.byteLength,
  };
}

/**
 * Creates a RemoteAttachment from encrypted data and URL
 * @param encryptedAttachment - The encrypted attachment data
 * @param fileUrl - URL where the encrypted file is accessible
 * @returns RemoteAttachment object ready to be sent
 */
export function createRemoteAttachmentFromEncrypted(
  encryptedAttachment: EncryptedAttachment,
  fileUrl: string,
): RemoteAttachment {
  const scheme = `${new URL(fileUrl).protocol}//`;

  return {
    url: fileUrl,
    contentDigest: encryptedAttachment.metadata.contentDigest,
    salt: encryptedAttachment.metadata.salt,
    nonce: encryptedAttachment.metadata.nonce,
    secret: encryptedAttachment.metadata.secret,
    scheme: scheme,
    filename: encryptedAttachment.filename,
    contentLength: encryptedAttachment.metadata.contentLength,
  };
}

/**
 * Loads and decodes a remote attachment
 * @param remoteAttachment - The remote attachment to decode
 * @param client - XMTP client instance
 * @returns Decoded attachment with file data
 */
export async function loadRemoteAttachment(
  remoteAttachment: RemoteAttachment,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any, // Using any to avoid complex type constraints
): Promise<Attachment> {
  const decodedAttachment = await RemoteAttachmentCodec.load(
    remoteAttachment,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    client,
  );

  return decodedAttachment as Attachment;
}
