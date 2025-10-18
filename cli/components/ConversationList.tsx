import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { XmtpClient } from "../xmtp-client.js";
import type { ConversationInfo } from "../types.js";
import { RED } from "../constants.js";

interface ConversationListProps {
  client: XmtpClient;
  onSelect: (index: number) => void;
  onQuit: () => void;
}

const INSTRUCTIONS = "Select a conversation number or 'q' to go back";

export const ConversationList: React.FC<ConversationListProps> = ({
  client,
  onSelect,
  onQuit,
}) => {
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState("");

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const convos = await client.getConversations();
        const infos = await Promise.all(
          convos.map((c) => client.getConversationInfo(c)),
        );
        setConversations(infos);
      } catch (error) {
        console.error("Error loading conversations:", error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [client]);

  const handleSubmit = () => {
    if (selection.toLowerCase() === "q") {
      onQuit();
      return;
    }

    const index = parseInt(selection) - 1;
    if (!isNaN(index) && index >= 0 && index < conversations.length) {
      onSelect(index);
    } else {
      setSelection("");
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={RED}>Loading conversations...</Text>
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={RED}>
          No conversations found. Start a conversation on XMTP first!
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor={RED}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color={RED}>
            YOUR CONVERSATIONS
          </Text>
        </Box>

        <Box
          borderStyle="single"
          borderColor={RED}
          marginBottom={1}
          height={0}
        />

        {conversations.map((conv, i) => (
          <Box key={conv.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text bold color={RED}>
                {i + 1}.
              </Text>
              <Text> </Text>
              {conv.type === "group" ? (
                <>
                  <Text color={RED}>[GROUP]</Text>
                  <Text> {conv.name}</Text>
                </>
              ) : (
                <>
                  <Text color={RED}>[DM]</Text>
                  <Text> {conv.peerInboxId?.slice(0, 16)}...</Text>
                </>
              )}
            </Box>
            <Box marginLeft={3}>
              <Text dimColor>
                {conv.type === "group" ? `${conv.memberCount} members • ` : ""}
                ID: {conv.id.slice(0, 12)}...
              </Text>
            </Box>
          </Box>
        ))}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{INSTRUCTIONS}</Text>
        <Box>
          <Text color={RED}>(1-{conversations.length}): </Text>
          <TextInput
            value={selection}
            onChange={setSelection}
            onSubmit={handleSubmit}
          />
        </Box>
      </Box>
    </Box>
  );
};
