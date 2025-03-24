import { DecodedMessage, SafeGroupMember } from "@xmtp/browser-sdk";

interface MessageListProps {
  messages: DecodedMessage[];
  groupMembers: SafeGroupMember[];
  clientInboxId?: string;
}

export default function MessageList({
  messages,
  groupMembers,
  clientInboxId,
}: MessageListProps) {
  return (
    <div className="flex flex-col gap-2 w-full min-h-[400px]">
      {messages.map((message) => {
        const isSender = clientInboxId === message.senderInboxId;
        const member = groupMembers.find(
          (member) => member.inboxId === message.senderInboxId,
        );
        const senderDisplayName = member
          ? member.accountIdentifiers[0].identifier
          : message.senderInboxId;
        return (
          <div
            key={message.id}
            className={`flex flex-row text-sm w-full ${isSender ? "justify-end" : "justify-start"}`}>
            <div
              className={`flex flex-col gap-1 items-start rounded-xl px-2 py-1 ${isSender ? "bg-blue-500 rounded-br-none items-end" : "bg-gray-600 text-white items-start rounded-bl-none"}`}>
              <p>{`${senderDisplayName.slice(0, 6)}...${senderDisplayName.slice(-4)}`}</p>
              <p>{message.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
