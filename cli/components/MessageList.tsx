import React from "react";
import { Box, Text } from "ink";
import type { FormattedMessage } from "../types.js";
import { RED } from "../constants.js";

interface MessageListProps {
  messages: FormattedMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
      {messages.map((message) => {
        const senderShort = message.senderInboxId.slice(0, 8);
        const sender = message.isFromSelf ? "You" : senderShort;

        return (
          <Box key={message.id}>
            <Text dimColor>[{formatTime(message.timestamp)}]</Text>
            <Text> </Text>
            <Text bold color={RED}>
              {sender}
            </Text>
            <Text>: {message.content}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
