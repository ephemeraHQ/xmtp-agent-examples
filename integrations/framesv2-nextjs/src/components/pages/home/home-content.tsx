"use client";

import { Conversation } from "@xmtp/browser-sdk";
import { useEffect, useState } from "react";
import { useXMTP } from "@/context/xmtp-context";
import { useConversations } from "@/hooks/use-conversations";
import ConversationsPage from "./conversations-page";
import CurrentConversationPage from "./current-conversation-page";

export default function HomeContent() {
  const { setConversations } = useXMTP();
  const { list } = useConversations();
  const [currentConversation, setCurrentConversation] = useState<
    Conversation | undefined
  >(undefined);

  useEffect(() => {
    const loadConversations = async () => {
      const newConversations = await list(undefined, true);
      setConversations(newConversations);
    };
    void loadConversations();
  }, []);

  const handleSetConversation = (conv: Conversation) => {
    setCurrentConversation(conv);
  };

  const handleBackToConversations = () => {
    setCurrentConversation(undefined);
  };

  return (
    <div className="min-h-screen flex flex-col gap-2 px-4 py-2">
      {!currentConversation ? (
        <ConversationsPage onSelectConversation={handleSetConversation} />
      ) : (
        <CurrentConversationPage
          conversation={currentConversation}
          onBack={handleBackToConversations}
        />
      )}
    </div>
  );
}
