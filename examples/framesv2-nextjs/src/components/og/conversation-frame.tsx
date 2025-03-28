import { OG_IMAGE_SIZE } from "@/lib/constants";

interface ConversationFrameProps {
  conversationId: string;
}

export function ConversationFrame({ conversationId }: ConversationFrameProps) {
  return (
    <div
      tw={`relative flex flex-col w-[${OG_IMAGE_SIZE.width}px] h-[${OG_IMAGE_SIZE.height}px] bg-[#0A0A0A] text-white`}
      style={{ fontFamily: "Inter" }}>
      <p tw="text-2xl font-bold">Conversation {conversationId.slice(0, 5)}</p>
    </div>
  );
}
