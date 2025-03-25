"use client";

import farcasterFrame from "@farcaster/frame-wagmi-connector";
import { ClientOptions, XmtpEnv } from "@xmtp/browser-sdk";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { hexToUint8Array, uint8ArrayToHex } from "uint8array-extras";
import { useLocalStorage } from "usehooks-ts";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { FullPageLoader } from "@/components/ui/fullpage-loader";
import { Header } from "@/components/ui/header";
import { SafeAreaContainer } from "@/components/ui/safe-area-container";
import { useXMTP } from "@/context/xmtp-context";
import { env } from "@/lib/env";
import { createBrowserSigner } from "@/lib/utils";
import { useFrame } from "@/providers/frame-provider";

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
  const [encryptionKey] = useLocalStorage(
    "XMTP_ENCRYPTION_KEY",
    uint8ArrayToHex(crypto.getRandomValues(new Uint8Array(32))),
  );
  const [loggingLevel] = useLocalStorage<ClientOptions["loggingLevel"]>(
    "XMTP_LOGGING_LEVEL",
    "off",
  );

  // Connect to Farcaster wallet
  useEffect(() => {
    if (!isConnected || !address) {
      connect({ connector: farcasterFrame() });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // Initialize XMTP client with wallet signer
  useEffect(() => {
    if (walletData?.account) {
      void initialize({
        encryptionKey: hexToUint8Array(encryptionKey),
        env: env.XMTP_ENV,
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
        if (!context.client.added) await actions?.addFrame();
      }
    }
    saveFrame();
  }, [context, actions]);

  return (
    <SafeAreaContainer insets={insets}>
      <div
        className={
          "flex flex-col gap-0 pb-1 w-full max-w-full h-screen max-h-screen overflow-hidden bg-black transition-all duration-300"
        }>
        <Header />
        {initializing ? <FullPageLoader /> : <HomeContent />}
      </div>
    </SafeAreaContainer>
  );
}
