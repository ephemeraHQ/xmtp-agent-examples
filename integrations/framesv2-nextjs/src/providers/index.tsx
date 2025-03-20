"use client";

import dynamic from "next/dynamic";
import { XMTPProvider } from "@/context/xmtp-context";
import { CustomWagmiProvider } from "./custom-wagmi-provider";
import { FrameProvider } from "./frame-provider";

const ErudaProvider = dynamic(
  () => import("@/providers/eruda").then((c) => c.ErudaProvider),
  {
    ssr: false,
  },
);

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ErudaProvider>
      <FrameProvider>
        <CustomWagmiProvider>
          <XMTPProvider>{children}</XMTPProvider>
        </CustomWagmiProvider>
      </FrameProvider>
    </ErudaProvider>
  );
};
