import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { MessageList } from "./MessageList.js";
import { InputBox } from "./InputBox.js";
import type { XmtpClient } from "../xmtp-client.js";
import type { Conversation, FormattedMessage } from "../types.js";
import { RED } from "../constants.js";

interface ChatViewProps {
  client: XmtpClient;
  conversation: Conversation | null;
  onBack: () => void;
  onExit: () => void;
  onShowConversations: () => void;
  onSwitchConversation: (index: number) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  client,
  conversation,
  onBack,
  onExit,
  onShowConversations,
  onSwitchConversation,
}) => {
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [conversationInfo, setConversationInfo] = useState<{
    type: string;
    name?: string;
    peerInboxId?: string;
  } | null>(null);
  const { exit } = useApp();

  // Load initial messages
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      setConversationInfo(null);
      return;
    }

    const loadMessages = async () => {
      const rawMessages = await client.getMessages(conversation);
      const formatted = rawMessages
        .map((msg) => client.formatMessage(msg, client.inboxId))
        .slice(-50); // Keep last 50 messages
      setMessages(formatted);

      const info = await client.getConversationInfo(conversation);
      setConversationInfo(info);
    };

    loadMessages();
  }, [conversation, client]);

  // Stream new messages
  useEffect(() => {
    if (!conversation) return;

    let isActive = true;

    const startStream = async () => {
      try {
        await client.streamMessages((message) => {
          if (!isActive || message.conversationId !== conversation.id) {
            return;
          }

          const formatted = client.formatMessage(message, client.inboxId);
          setMessages((prev) => [...prev, formatted]);
        });
      } catch (error) {
        console.error("Error streaming messages:", error);
      }
    };

    startStream();

    return () => {
      isActive = false;
    };
  }, [conversation, client]);

  const handleSubmit = async (text: string) => {
    // Handle commands
    if (text === "/exit") {
      exit();
      onExit();
      return;
    }

    if (text === "/conversations") {
      onShowConversations();
      return;
    }

    if (text === "/back" && conversation) {
      onBack();
      return;
    }

    if (text.startsWith("/chat ")) {
      const parts = text.split(" ");
      if (parts.length === 2) {
        const index = parseInt(parts[1]) - 1;
        if (!isNaN(index)) {
          onSwitchConversation(index);
          return;
        }
      }
      // Invalid format - just ignore for now
      return;
    }

    // If no conversation selected, can't send messages
    if (!conversation) {
      return;
    }

    // Send message
    try {
      await client.sendMessage(conversation, text);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const getHeaderText = () => {
    if (!conversation) {
      return "XMTP Chat - Ready";
    }
    if (!conversationInfo) return "Loading...";
    if (conversationInfo.type === "group") {
      return `GROUP: ${conversationInfo.name}`;
    }
    const peerId = conversationInfo.peerInboxId?.slice(0, 16) + "...";
    return `DM: ${peerId}`;
  };

  const getPlaceholder = () => {
    if (!conversation) {
      return "Type /conversations to see your chats...";
    }
    return "Send a message...";
  };

  const getCommands = () => {
    if (!conversation) {
      return "Commands: /conversations • /exit";
    }
    return "Commands: /conversations • /back • /exit";
  };

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="round" borderColor={RED} paddingX={1} marginBottom={1}>
        <Text bold color={RED}>
          {getHeaderText()}
        </Text>
      </Box>

      {!conversation && messages.length === 0 && (
        <Box
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          justifyContent="center"
        >
          <Text dimColor>Welcome to XMTP Chat!</Text>
          <Text dimColor>Type /conversations to see your conversations</Text>
          <Text dimColor>Or use /exit to quit</Text>
        </Box>
      )}

      {conversation && <MessageList messages={messages} />}

      <InputBox
        onSubmit={handleSubmit}
        placeholder={getPlaceholder()}
        commands={getCommands()}
      />
    </Box>
  );
};
