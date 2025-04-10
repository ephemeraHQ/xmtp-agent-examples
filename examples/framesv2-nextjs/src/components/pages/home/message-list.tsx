import {
  Conversation,
  DecodedMessage,
  SafeGroupMember,
} from "@xmtp/browser-sdk";
import {
  ContentTypeTransactionReference,
  TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsParams,
} from "@xmtp/content-type-wallet-send-calls";
import {
  TextMessage,
  TxReference,
  WalletSendCalls,
} from "@/components/ui/message";

interface MessageListProps {
  messages: DecodedMessage[];
  groupMembers: SafeGroupMember[];
  clientInboxId?: string;
  conversation: Conversation;
  refreshMessages: () => void;
}

export default function MessageList({
  messages,
  groupMembers,
  clientInboxId,
  conversation,
  refreshMessages,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      {messages.map((message) => {
        const isSender = clientInboxId === message.senderInboxId;
        const member = groupMembers.find(
          (member) => member.inboxId === message.senderInboxId,
        );
        const senderDisplayName = member
          ? member.accountIdentifiers[0].identifier
          : message.senderInboxId;

        if (message.contentType.sameAs(ContentTypeTransactionReference)) {
          return (
            <TxReference
              key={message.id}
              content={message.content as TransactionReference}
              isSender={isSender}
              senderDisplayName={senderDisplayName}
            />
          );
        } else if (message.contentType.sameAs(ContentTypeWalletSendCalls)) {
          return (
            <WalletSendCalls
              key={message.id}
              content={message.content as WalletSendCallsParams}
              conversation={conversation}
              isSender={isSender}
              senderDisplayName={senderDisplayName}
              refreshMessages={refreshMessages}
            />
          );
        } else {
          return (
            <TextMessage
              key={message.id}
              message={message}
              isSender={isSender}
              senderDisplayName={senderDisplayName}
            />
          );
        }
      })}
    </div>
  );
}
