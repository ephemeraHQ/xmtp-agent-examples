"use client";

import dynamic from "next/dynamic";
import { FrameProvider } from "@/context/frame-context";
import { XMTPProvider } from "@/context/xmtp-context";
import { CustomWagmiProvider } from "./custom-wagmi-provider";

const ErudaProvider = dynamic(
  () => import("@/providers/eruda").then((c) => c.ErudaProvider),
  {
    ssr: false,
  },
);

export const Providers = ({
  children,
  cookies,
}: {
  children: React.ReactNode;
  cookies: string | null;
}) => {
  return (
    <ErudaProvider>
      <FrameProvider>
        <CustomWagmiProvider cookies={cookies}>
          <XMTPProvider>{children}</XMTPProvider>
        </CustomWagmiProvider>
      </FrameProvider>
    </ErudaProvider>
  );
};
