import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CodecRegistry } from "@xmtp/content-type-primitives";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
  type Attachment,
  type RemoteAttachment,
} from "@xmtp/content-type-remote-attachment";

export interface EncryptedAttachment {
  encryptedData: Uint8Array;
  filename: string;
}

export async function encryptAttachment(
  data: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<EncryptedAttachment> {
  // @eslint-disable-next-line TODO: fix this
  const encrypted = await RemoteAttachmentCodec.encodeEncrypted(
    { filename, mimeType, data },
    new AttachmentCodec(),
  );
  return { encryptedData: encrypted.payload, filename };
}

export async function createRemoteAttachmentFromFile(
  filePath: string,
  fileUrl: string,
  mimeType: string,
): Promise<RemoteAttachment> {
  const fileData = await readFile(filePath);
  const filename = path.basename(filePath);
  return createRemoteAttachmentFromData(
    new Uint8Array(fileData),
    filename,
    mimeType,
    fileUrl,
  );
}

export async function createRemoteAttachmentFromData(
  data: Uint8Array,
  filename: string,
  mimeType: string,
  fileUrl: string,
): Promise<RemoteAttachment> {
  // @eslint-disable-next-line TODO: fix this
  const encrypted = await RemoteAttachmentCodec.encodeEncrypted(
    { filename, mimeType, data },
    new AttachmentCodec(),
  );

  return {
    url: fileUrl,
    contentDigest: encrypted.digest,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    secret: encrypted.secret,
    scheme: `${new URL(fileUrl).protocol}//`,
    filename,
    contentLength: data.byteLength,
  };
}

export async function loadRemoteAttachment(
  remoteAttachment: RemoteAttachment,
  client: CodecRegistry,
): Promise<Attachment> {
  // @eslint-disable-next-line TODO: fix this
  return await RemoteAttachmentCodec.load(
    remoteAttachment,
    client as unknown as CodecRegistry,
  );
}
