"use client";

import { Conversation } from "@xmtp/browser-sdk";
import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { Plus, Send } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/shadcn/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/shadcn/drawer";
import { Input } from "@/components/shadcn/input";
import { NumberInput } from "@/components/shadcn/number-input";
import { useConversation } from "@/hooks/use-conversation";
import { createUSDCTransferCalls } from "@/lib/utils";

interface SendMessageProps {
  conversation: Conversation;
  loadMessages: () => void;
  memberAddress?: `0x${string}`;
}

export const SendMessage = ({
  conversation,
  loadMessages,
  memberAddress,
}: SendMessageProps) => {
  const { send, sending } = useConversation(conversation);
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const [amount, setAmount] = useState<number>(1);

  const handleSend = async () => {
    const tmpMessage = message;
    if (tmpMessage.trim() === "") return;
    setMessage("");
    await send(tmpMessage);
    void loadMessages();
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSendTx = async () => {
    if (!memberAddress) {
      console.log("Unable to find member address, skipping");
      return;
    }
    if (!amount || amount === 0) {
      console.log("Amount is 0, skipping");
      return;
    }
    // Convert amount to USDC decimals (6 decimal places)
    const amountInDecimals = Math.floor(amount * Math.pow(10, 6));

    const walletSendCalls = createUSDCTransferCalls(
      memberAddress,
      memberAddress,
      amountInDecimals,
    );
    await send(walletSendCalls, ContentTypeWalletSendCalls);
    void loadMessages();
  };

  return (
    <div className="flex flex-row items-center gap-2 w-full h-fit pt-0 pb-4">
      <Drawer>
        <DrawerTrigger asChild className="h-full">
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-500/80 text-white border border-green-300 my-0 h-full"
            disabled={sending}>
            <Plus className="size-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="bg-gray-900 max-w-md mx-auto">
          <DrawerHeader>
            <DrawerTitle>Request USDC</DrawerTitle>
            <DrawerDescription>
              Enter the amount of USDC you want to receive.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-row items-center gap-2 px-2">
            <NumberInput
              className="w-full"
              placeholder="1.00"
              prefix="USDC "
              value={amount}
              onValueChange={(newAmount) => {
                if (newAmount) setAmount(newAmount);
              }}
              min={0.1}
              max={100}
              stepper={1}
              decimalScale={2}
              disabled={sending}
            />
          </div>
          <DrawerFooter className="pb-10">
            <DrawerClose className="w-full ">
              <Button
                type="submit"
                variant="outline"
                onClick={handleSendTx}
                disabled={sending || !amount || amount === 0}
                className="w-full py-1 px-2 bg-green-500 hover:bg-green-500/80 text-black font-semibold">
                Request
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
      <Input
        ref={inputRef}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSend();
          } else if (e.key === "Escape") {
            inputRef.current?.blur();
          }
        }}
        placeholder="Message..."
        className="w-full h-full px-3 rounded-xl border border-gray-300 bg-gray-800 text-white"
      />
      <Button
        variant="default"
        onClick={handleSend}
        className="bg-blue-600 hover:bg-blue-600/80 text-white border border-blue-300 my-0 h-full"
        disabled={sending}>
        <Send className="size-4" />
      </Button>
    </div>
  );
};
