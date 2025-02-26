import { getRandomValues } from "node:crypto";
import { fromString, toString } from "uint8arrays";
import { toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Create a signer from a private key
 * @param privateKey - The private key of the account
 * @returns The signer
 */
export const createSigner = (privateKey: `0x${string}`) => {
  /* Convert the private key to an account */
  const account = privateKeyToAccount(privateKey);
  /* Return the signer */
  return {
    getAddress: () => account.address,
    signMessage: async (message: string) => {
      const signature = await account.signMessage({
        message,
      });
      return toBytes(signature);
    },
  };
};

/**
 * Generate a random encryption key
 * @returns The encryption key
 */
export const generateEncryptionKeyHex = () => {
  /* Generate a random encryption key */
  const uint8Array = getRandomValues(new Uint8Array(32));
  /* Convert the encryption key to a hex string */
  return toString(uint8Array, "hex");
};

/**
 * Get the encryption key from a hex string
 * @param hex - The hex string
 * @returns The encryption key
 */
export const getEncryptionKeyFromHex = (hex: string) => {
  /* Convert the hex string to an encryption key */
  return fromString(hex, "hex");
};
