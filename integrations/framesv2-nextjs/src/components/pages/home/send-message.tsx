import { Conversation } from "@xmtp/browser-sdk";
import { useRef, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { useConversation } from "@/hooks/use-conversation";

interface SendMessageProps {
  conversation: Conversation;
  loadMessages: () => void;
}

export const SendMessage = ({
  conversation,
  loadMessages,
}: SendMessageProps) => {
  const { send, sending } = useConversation(conversation);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="absolute bottom-0 left-0 flex flex-row items-center gap-2 w-full">
      <input
        ref={inputRef}
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message..."
        className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-800 text-white"
      />
      <Button
        variant="default"
        onClick={handleSend}
        className="bg-blue-600 hover:bg-blue-600/80 text-white border border-blue-300"
        disabled={sending}>
        {sending ? "Sending..." : "Send"}
      </Button>
    </div>
  );
};
