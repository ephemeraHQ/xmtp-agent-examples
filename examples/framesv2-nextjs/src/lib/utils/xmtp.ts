import type { Signer as BrowserSigner } from "@xmtp/browser-sdk";
import type { Signer as NodeSigner } from "@xmtp/node-sdk";
import {
  createWalletClient,
  Hex,
  http,
  toBytes,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

/**
 * Creates a browser signer for XMTP from the user connected wallet
 * @param address - The address of the user
 * @param walletClient - The wallet client
 * @returns The browser signer
 */
export const createBrowserSigner = (
  address: `0x${string}`,
  walletClient: WalletClient,
): BrowserSigner => {
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifier: address.toLowerCase(),
      identifierKind: "Ethereum",
    }),
    signMessage: async (message: string) => {
      const signature = await walletClient.signMessage({
        account: address,
        message,
      });
      return toBytes(signature);
    },
  };
};

interface User {
  key: `0x${string}`;
  account: ReturnType<typeof privateKeyToAccount>;
  wallet: ReturnType<typeof createWalletClient>;
}

/**
 * Creates a user for XMTP
 * @param key - The private key of the user
 * @returns The user
 */
export const createUser = (key: Hex): User => {
  const accountKey = key;
  const account = privateKeyToAccount(accountKey);
  return {
    key: accountKey,
    account,
    wallet: createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    }),
  };
};

/**
 * Creates a node ephemeral signer for XMTP from a private key
 * @param privateKey - The private key of the user
 * @returns The node ephemeral signer
 */
export const createNodeEphemeralSigner = (privateKey: Hex): NodeSigner => {
  const user = createUser(privateKey);
  console.log("Creating node ephemeral signer for user", user.account.address);
  return {
    type: "EOA",
    getIdentifier: () => ({
      identifier: user.account.address.toLowerCase(),
      identifierKind: 0, // 0 = Ethereum, 1 = Passkey
    }),
    signMessage: async (message: string) => {
      const signature = await user.wallet.signMessage({
        account: user.account.address,
        message,
      });
      return toBytes(signature);
    },
  };
};
