import { DecodedMessage } from "@xmtp/browser-sdk";

interface TextMessageProps {
  message: DecodedMessage;
  isSender: boolean;
  senderDisplayName: string;
}

export function TextMessage({
  message,
  isSender,
  senderDisplayName,
}: TextMessageProps) {
  return (
    <div
      className={`flex flex-row text-sm w-full ${isSender ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex flex-col gap-1 items-start rounded-xl px-2 py-1 ${isSender ? "bg-blue-500 rounded-br-none items-end" : "bg-gray-600 text-white items-start rounded-bl-none"}`}>
        <p
          className={`text-xs ${isSender ? "text-gray-900" : "text-white/70"}`}>{`${senderDisplayName.slice(0, 6)}...${senderDisplayName.slice(-4)}`}</p>
        {typeof message.content === "string" ? (
          <p className="text-sm font-semibold max-w-[250px] overflow-hidden overflow-x-scroll no-scrollbar">
            {message.content}
          </p>
        ) : (
          <p className="text-sm font-semibold max-w-[250px] overflow-hidden overflow-x-scroll no-scrollbar">
            {JSON.stringify(message.content, null, 2)}
          </p>
        )}
      </div>
    </div>
  );
}
