import { getRandomValues } from "node:crypto";
import type { Signer } from "@xmtp/node-sdk";
import { fromString, toString } from "uint8arrays";
import { createWalletClient, http, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

interface User {
  key: string;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

export const createUser = (key: string): User => {
  const account = privateKeyToAccount(key as `0x${string}`);
  return {
    key,
    account,
    wallet: createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    }),
  };
};

export const createSigner = (key: string): Signer => {
  const user = createUser(key);
  return {
    walletType: "EOA",
    getAddress: () => user.account.address,
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        message,
        account: user.account,
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
