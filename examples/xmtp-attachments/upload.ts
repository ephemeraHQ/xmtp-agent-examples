import { validateEnvironment } from "@helpers/client";
import axios from "axios";
import FormData from "form-data";

const { PINATA_API_KEY, PINATA_SECRET_KEY } = validateEnvironment([
  "PINATA_API_KEY",
  "PINATA_SECRET_KEY",
]);

export async function uploadToPinata(
  fileData: Uint8Array,
  filename: string,
): Promise<string> {
  console.log(`Uploading ${filename}, size: ${fileData.byteLength} bytes`);

  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  const data = new FormData();
  data.append("file", Buffer.from(fileData), {
    filename,
    contentType: "application/octet-stream",
  });

  // Using type assertion for FormData with _boundary property
  const response = await axios.post(url, data, {
    maxContentLength: Infinity,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${(data as FormData & { _boundary: string })._boundary}`,
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_SECRET_KEY,
    },
  });

  interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
  }

  const ipfsHash = (response.data as PinataResponse).IpfsHash;
  const fileUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  console.log("File URL:", fileUrl);

  return fileUrl;
}
