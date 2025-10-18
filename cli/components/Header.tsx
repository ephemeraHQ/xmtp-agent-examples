import React from "react";
import { Box, Text } from "ink";
import { RED } from "../constants.js";

interface HeaderProps {
  address: string;
  inboxId: string;
  conversationCount: number;
  installationCount: number;
  env: string;
}

export const Header: React.FC<HeaderProps> = ({
  address,
  inboxId,
  conversationCount,
  installationCount,
  env,
}) => {
  const shortInboxId = `${inboxId.slice(0, 8)}...${inboxId.slice(-8)}`;
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const logoLines = [
    " ██╗  ██╗███╗   ███╗████████╗██████╗ ",
    " ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗",
    "  ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝",
    "  ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ ",
    " ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     ",
    " ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     ",
  ];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={RED}
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        <Box flexDirection="column" marginRight={2}>
          {logoLines.map((line, i) => (
            <Text key={i} color={RED}>
              {line}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" justifyContent="center">
          <Text bold color={RED}>
            ✓ XMTP Client Initialized
          </Text>
          <Text dimColor>
            InboxId: <Text color={RED}>{shortInboxId}</Text>
          </Text>
          <Text dimColor>
            Address: <Text color={RED}>{shortAddress}</Text>
          </Text>
          <Text dimColor>
            Conversations: <Text color={RED}>{conversationCount}</Text> •
            Installations: <Text color={RED}>{installationCount}</Text>
          </Text>
          <Text dimColor>
            Network: <Text color={RED}>{env}</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
