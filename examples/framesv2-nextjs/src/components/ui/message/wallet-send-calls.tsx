import { type Conversation } from "@xmtp/browser-sdk";
import {
  ContentTypeTransactionReference,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import type { WalletSendCallsParams } from "@xmtp/content-type-wallet-send-calls";
import { useCallback } from "react";
import { useChainId, useSendTransaction, useSwitchChain } from "wagmi";
import { Button } from "@/components/shadcn/button";

interface WalletSendCallsProps {
  content: WalletSendCallsParams;
  conversation: Conversation;
  isSender: boolean;
  senderDisplayName: string;
  refreshMessages: () => void;
}

export function WalletSendCalls({
  content,
  conversation,
  isSender,
  senderDisplayName,
  refreshMessages,
}: WalletSendCallsProps) {
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const wagmiChainId = useChainId();

  const handleSubmit = useCallback(async () => {
    const chainId = parseInt(content.chainId, 16);
    if (chainId !== wagmiChainId) {
      console.log(
        `Current Chain Id (${wagmiChainId}) doesn't match; switching to Chain Id ${chainId}.`,
      );
      await switchChainAsync({ chainId });
      await new Promise((r) => setTimeout(r, 300)); // Metamask requires some delay
    }
    for (const call of content.calls) {
      const wagmiTxData = {
        ...call,
        value: BigInt(parseInt(call.value || "0x0", 16)),
        chainId,
        gas: call.gas ? BigInt(parseInt(call.gas, 16)) : undefined,
      };
      const txHash = await sendTransactionAsync(wagmiTxData, {
        onError(error) {
          console.error(error);
        },
      });
      const transactionReference: TransactionReference = {
        networkId: content.chainId,
        reference: txHash,
      };
      if (!conversation) {
        console.error("Couldn't find conversation by Id");
        return;
      }
      await conversation.send(
        transactionReference,
        ContentTypeTransactionReference,
      );
      void refreshMessages();
    }
  }, [content, sendTransactionAsync, conversation, refreshMessages]);

  return (
    <div
      className={`flex flex-row text-sm w-full ${isSender ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex flex-col gap-1 rounded-xl px-1 py-1 text-sm w-fit ${isSender ? "bg-blue-500 rounded-br-none items-end justify-end" : "bg-gray-600 rounded-bl-none items-start justify-start"}`}>
        <p
          className={`text-xs ${isSender ? "text-gray-900" : "text-white/70"}`}>{`${senderDisplayName.slice(0, 6)}...${senderDisplayName.slice(-4)}`}</p>
        <div
          className={`flex flex-col gap-1 items-start rounded-lg px-2 py-1 bg-white text-blue-600 font-semibold ${isSender ? "items-end" : "items-start"}`}>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-600">
              Review the following transaction
            </p>
            <ol className="flex flex-col gap-0 list-disc list-inside">
              {content.calls.map((call, index) => (
                <li
                  key={`wallet-send-calls-${call.to}-${index}`}
                  className="max-w-[300px] overflow-hidden overflow-x-scroll no-scrollbar">
                  {call.metadata?.description}
                </li>
              ))}
            </ol>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          className="w-fit bg-green-500 text-black font-bold">
          Execute
        </Button>
      </div>
    </div>
  );
}
