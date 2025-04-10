"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/shadcn/skeleton";
import { useFrame } from "@/context/frame-context";
import { Logo } from "./logo";

export const Header = () => {
  const { context } = useFrame();
  const { address } = useAccount();

  let pfpUrl = context && context.user.pfpUrl ? context.user.pfpUrl : undefined;

  return (
    <motion.header
      className="flex justify-between items-center w-full px-3 py-2 bg-black border-b-[1px] border-[#323232] text-white shadow-md z-50"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      id="navbar">
      <div className="flex flex-row gap-2 items-center justify-center tracking-tight my-0 py-1">
        <Logo className="w-[28px] h-[28px] cursor-pointer" />
        <h1 className="text-lg sm:text-xl font-bold text-white">XMTP Chat</h1>
      </div>

      <div className="flex flex-row gap-2 items-center justify-center">
        {address && (
          <p className="text-white text-xs font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}
        {pfpUrl ? (
          <Image
            src={pfpUrl}
            alt="user-pfp"
            className="w-[36px] h-[36px] aspect-square shrink-0 rounded-full border object-cover bg-app border-default"
            width={36}
            height={36}
          />
        ) : (
          <Skeleton className="h-[36px] w-[36px] rounded-full bg-white/20" />
        )}
      </div>
    </motion.header>
  );
};
