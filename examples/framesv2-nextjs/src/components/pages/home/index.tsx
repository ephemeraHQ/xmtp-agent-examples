"use client";

import farcasterFrame from "@farcaster/frame-wagmi-connector";
import { ClientOptions } from "@xmtp/browser-sdk";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { hexToUint8Array } from "uint8array-extras";
import { useLocalStorage } from "usehooks-ts";
import { injected, useAccount, useConnect, useWalletClient } from "wagmi";
import { FullPageLoader } from "@/components/ui/fullpage-loader";
import { Header } from "@/components/ui/header";
import { SafeAreaContainer } from "@/components/ui/safe-area-container";
import { useFrame } from "@/context/frame-context";
import { useXMTP } from "@/context/xmtp-context";
import { env } from "@/lib/env";
import { createBrowserSigner } from "@/lib/utils";

const HomeContent = dynamic(
  () => import("@/components/pages/home/home-content"),
  {
    ssr: false,
  },
);
export default function HomePage() {
  const { context, actions } = useFrame();
  const insets = context ? context.client.safeAreaInsets : undefined;
  const { initialize, initializing } = useXMTP();
  const { data: walletData } = useWalletClient();
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const [encryptionKey] = useLocalStorage("XMTP_ENCRYPTION_KEY", "");
  const [loggingLevel] = useLocalStorage<ClientOptions["loggingLevel"]>(
    "XMTP_LOGGING_LEVEL",
    "off",
  );

  // Connect to Farcaster wallet
  useEffect(() => {
    if (!isConnected || !address) {
      // if you are on warpcast, connect to farcasterFrame
      if (context) {
        connect({ connector: farcasterFrame() });
      } else {
        connect({ connector: injected() });
      }
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Initialize XMTP client with wallet signer
  useEffect(() => {
    if (walletData?.account) {
      void initialize({
        dbEncryptionKey: encryptionKey
          ? hexToUint8Array(encryptionKey)
          : undefined,
        env: env.NEXT_PUBLIC_XMTP_ENV,
        loggingLevel,
        signer: createBrowserSigner(walletData.account.address, walletData),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletData]);

  // Save the frame to the Farcaster context
  useEffect(() => {
    async function saveFrame() {
      if (context) {
        if (!context.client.added) {
          try {
            await actions?.addFrame();
          } catch (e) {
            console.error("Error adding frame:", e);
          }
        }
      }
    }
    saveFrame();
  }, [context, actions]);

  return (
    <SafeAreaContainer insets={insets}>
      <div
        className={
          "flex flex-col gap-0 pb-1 w-full max-w-md mx-auto h-screen bg-black transition-all duration-300"
        }>
        <Header />
        {initializing ? <FullPageLoader /> : <HomeContent />}
      </div>
    </SafeAreaContainer>
  );
}
