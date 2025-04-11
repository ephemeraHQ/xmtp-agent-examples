"use client";

import type { TransactionReference } from "@xmtp/content-type-transaction-reference";
import { useMemo } from "react";
import * as viemChains from "viem/chains";
import { Button } from "@/components/shadcn/button";
import { useFrame } from "@/context/frame-context";

interface TxReferenceProps {
  content: TransactionReference;
  isSender: boolean;
  senderDisplayName: string;
}

export function TxReference({
  content,
  isSender,
  senderDisplayName,
}: TxReferenceProps) {
  const { context, actions } = useFrame();

  const chain = useMemo(() => {
    const chains = Object.values(viemChains);
    const chainId =
      typeof content.networkId === "string"
        ? parseInt(content.networkId, 16)
        : content.networkId;
    return chains.find((chain) => chain.id === chainId);
  }, [content.networkId]);

  const handleClick = () => {
    if (context) {
      actions?.openUrl(
        `${chain?.blockExplorers?.default.url}/tx/${content.reference}`,
      );
    } else {
      window.open(
        `${chain?.blockExplorers?.default.url}/tx/${content.reference}`,
        "_blank",
      );
    }
  };

  if (!chain) {
    return (
      <div>
        <p>Chain Id: {content.networkId}</p>
        <p>Transaction Hash: {content.reference}</p>
      </div>
    );
  }
  return (
    <div
      className={`flex flex-row text-sm w-full ${isSender ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex flex-col gap-1 items-start rounded-xl px-2 py-1 ${isSender ? "bg-blue-500 rounded-br-none items-end" : "bg-gray-600 text-white items-start rounded-bl-none"}`}>
        <p
          className={`text-xs ${isSender ? "text-gray-900" : "text-white/70"}`}>{`${senderDisplayName.slice(0, 6)}...${senderDisplayName.slice(-4)}`}</p>
        <Button
          onClick={handleClick}
          className="w-fit bg-green-500 text-black font-bold">
          View tx in explorer
        </Button>
      </div>
    </div>
  );
}
