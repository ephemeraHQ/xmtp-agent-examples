import { type Signer } from "@xmtp/browser-sdk";
import { Account, createWalletClient, http, toBytes, WalletClient } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

/**
 * Create an ephemeral wallet using viem
 * @returns The wallet client and account
 */
export const createEphemeralWallet = (): {
  privateKey: `0x${string}`;
  account: Account;
  wallet: WalletClient;
} => {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  return {
    privateKey,
    account,
    wallet,
  };
};

/**
 * Create an XMTP signer from a private key
 * @param privateKey - The private key
 * @returns The XMTP signer
 */
export const createEphemeralSigner = (privateKey: `0x${string}`): Signer => {
  const account = privateKeyToAccount(privateKey);

  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(),
  });

  return {
    type: "EOA",
    getIdentifier: () => ({
      identifierKind: "Ethereum",
      identifier: account.address.toLowerCase(),
    }),
    signMessage: async (message: string) => {
      const signature = await wallet.signMessage({
        message,
        account,
      });
      return toBytes(signature);
    },
  };
};
