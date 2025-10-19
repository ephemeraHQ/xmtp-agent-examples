import "dotenv/config";
import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useApp } from "ink";
import TextInput from "ink-text-input";
import {
  Agent,
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
  type Group,
  type Dm,
} from "@xmtp/agent-sdk";
import { getRandomValues } from "node:crypto";
import { Client } from "@xmtp/node-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { fromString, toString } from "uint8arrays";

function showHelp(): void {
  console.log(`
XMTP CLI Chat Interface

Chat with your XMTP conversations directly from the terminal.

USAGE:
  yarn chat [options]

OPTIONS:
  --agent <address...>   Connect to agent(s) by Ethereum address or inbox ID
                        Single address: creates/opens a DM
                        Multiple addresses: creates a group chat
                        [auto-detected in dev environment if not provided]
  --env <environment>    XMTP environment (local, dev, production)
                        [default: production or XMTP_ENV]
  -h, --help            Show this help message

IN-CHAT COMMANDS:
  /list                  List all your conversations with numbers
  /chat <number>         Switch to a different conversation
  /back                  Return to conversation list
  /exit                  Quit the application

EXAMPLES:
  yarn chat
  yarn chat --env dev
  yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2
  yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2 0x1234567890abcdef1234567890abcdef12345678
  yarn chat --agent 1180478fde9f6dfd4559c25f99f1a3f1505e1ad36b9c3a4dd3d5afb68c419179

ENVIRONMENT VARIABLES:
  XMTP_ENV                       Default environment
  XMTP_CLIENT_WALLET_KEY         Wallet private key (required)
  XMTP_CLIENT_DB_ENCRYPTION_KEY  Database encryption key (required)
`);
}

// Red color - matching the original theme (rgb: 252, 76, 52)
const RED = "#fc4c34";
// Standard red for errors
const ERROR_RED = "#fc4c34";

// ============================================================================
// Types
// ============================================================================
interface FormattedMessage {
  timestamp: string;
  sender: string;
  content: string;
  isFromSelf: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================
const isGroup = (conversation: Conversation): conversation is Group => {
  return conversation.constructor.name === "Group";
};

const isDm = (conversation: Conversation): conversation is Dm => {
  return conversation.constructor.name === "Dm";
};

const isEthAddress = (identifier: string): boolean => {
  return identifier.startsWith("0x") && identifier.length === 42;
};

const handleError = (
  error: unknown,
  setError: (msg: string) => void,
  context: string,
  clearAfter?: number,
): void => {
  const err = error as Error;
  setError(`${context}: ${err.message}`);

  // Auto-clear error after specified time (default 5 seconds)
  if (clearAfter) {
    setTimeout(() => {
      setError("");
    }, clearAfter);
  }
};

// ============================================================================
// Reusable UI Components
// ============================================================================
interface StatusBoxProps {
  children: React.ReactNode;
  color?: string;
  borderColor?: string;
}

const StatusBox: React.FC<StatusBoxProps> = ({
  children,
  color = ERROR_RED,
  borderColor = ERROR_RED,
}) => (
  <Box flexDirection="column">
    <Box borderStyle="round" borderColor={borderColor} padding={1}>
      <Text color={color}>{children}</Text>
    </Box>
  </Box>
);

interface InfoTextProps {
  children: React.ReactNode;
  marginTop?: number;
}

const InfoText: React.FC<InfoTextProps> = ({ children, marginTop = 1 }) => (
  <Box flexDirection="column" marginTop={marginTop}>
    <Text dimColor>{children}</Text>
  </Box>
);

// ============================================================================
// Header Component
// ============================================================================
interface HeaderProps {
  conversation: Conversation | null;
  env: XmtpEnv;
  url: string;
  conversations: number;
  installations: number;
  address: string;
  inboxId: string;
}

const Header: React.FC<HeaderProps> = ({
  conversation,
  conversations,
  env,
  url,
  installations,
  address,
  inboxId,
}) => {
  const logoLines = [
    " ██╗  ██╗███╗   ███╗████████╗██████╗ ",
    " ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗",
    "  ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝",
    "  ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ ",
    " ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     ",
    " ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     ",
  ];

  if (!conversation) {
    // Show initialization header
    return (
      <Box flexDirection="column" marginBottom={0}>
        <Box paddingX={2} paddingY={1} flexDirection="row">
          <Box flexDirection="column">
            {logoLines.map((line, i) => (
              <Box key={i}>
                <Text color={RED}>{line}</Text>
              </Box>
            ))}
          </Box>
          <Box flexDirection="column" marginLeft={2}>
            <Text dimColor>
              InboxId: <Text color={RED}>{inboxId.slice(0, 36)}...</Text>
            </Text>
            <Text dimColor>
              Address: <Text color={RED}>{address}</Text>
            </Text>
            <Text dimColor>
              Conversations: <Text color={RED}>{conversations}</Text>
            </Text>
            <Text dimColor>
              Installations: <Text color={RED}>{installations}</Text>
            </Text>
            <Text dimColor>
              Network: <Text color={RED}>{env}</Text>
            </Text>
            <Text dimColor>
              URL: <Text color={RED}>{url.slice(0, 30)}...</Text>
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box paddingX={1} paddingY={0}>
        {isGroup(conversation) ? (
          <Text bold color={RED} inverse>
            {" "}
            GROUP: {conversation.name || "Unnamed Group"}{" "}
          </Text>
        ) : (
          <Text bold color={RED} inverse>
            {" "}
            DM: {(conversation as Dm).peerInboxId.slice(0, 16)}...{" "}
          </Text>
        )}
      </Box>
      <InfoText marginTop={1}>Commands: /list • /back • /exit</InfoText>
    </Box>
  );
};

// ============================================================================
// Messages Component
// ============================================================================
interface MessagesProps {
  messages: FormattedMessage[];
  height: number;
}

const Messages: React.FC<MessagesProps> = ({ messages, height }) => {
  // Show last N messages that fit in the height
  const visibleMessages = messages.slice(-height);

  // Helper function to format long text with proper indentation
  const formatLongText = (text: string, prefix: string) => {
    const lines = text.split("\n");
    if (lines.length === 1) {
      return text;
    }

    // For multi-line content, indent continuation lines
    return lines
      .map((line, index) => {
        if (index === 0) return line;
        // Add indentation to match the prefix length
        const indent = " ".repeat(prefix.length);
        return `${indent}${line}`;
      })
      .join("\n");
  };

  return (
    <Box flexDirection="column" marginY={1}>
      {visibleMessages.length === 0 ? (
        <Text dimColor>No messages yet...</Text>
      ) : (
        visibleMessages.map((msg, index) => {
          const prefix = `[${msg.timestamp}] ${msg.sender}: `;
          const formattedContent = formatLongText(msg.content, prefix);

          return (
            <Box key={index} flexDirection="column">
              <Text>
                <Text dimColor>[{msg.timestamp}] </Text>
                <Text bold color={RED}>
                  {msg.sender}:
                </Text>
                <Text> {formattedContent}</Text>
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};

// ============================================================================
// Input Component
// ============================================================================
interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

const InputBox: React.FC<InputBoxProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = "Send a message to the agent",
}) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          showCursor={true}
        />
      </Box>
    </Box>
  );
};

// ============================================================================
// Conversation List Component
// ============================================================================
interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={RED}>
        YOUR CONVERSATIONS
      </Text>
      <Box marginTop={1} flexDirection="column">
        {conversations.length === 0 ? (
          <Text color={RED}>No conversations found</Text>
        ) : (
          conversations.map((conv, index) => {
            const isCurrent = conv.id === currentConversationId;
            const label = isCurrent ? "●" : " ";

            if (isGroup(conv)) {
              return (
                <Box key={index}>
                  <Text color={RED}>{label}</Text>
                  <Text bold> {index + 1}.</Text>
                  <Text color={RED}> [GROUP]</Text>
                  <Text> {conv.name || "Unnamed"}</Text>
                </Box>
              );
            } else {
              const peerShort = (conv as Dm).peerInboxId.slice(0, 16) + "...";
              return (
                <Box key={index}>
                  <Text color={RED}>{label}</Text>
                  <Text bold> {index + 1}.</Text>
                  <Text color={RED}> [DM]</Text>
                  <Text> {peerShort}</Text>
                </Box>
              );
            }
          })
        )}
      </Box>
      <InfoText marginTop={1}>
        Use /chat &lt;number&gt; to switch conversations
      </InfoText>
    </Box>
  );
};

// ============================================================================
// Main App Component
// ============================================================================
interface AppProps {
  env: XmtpEnv;
  agentIdentifiers?: string[];
}

const App: React.FC<AppProps> = ({ env, agentIdentifiers }) => {
  const { exit } = useApp();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [address, setAddress] = useState<string>("");
  const [url, setUrl] = useState<string>("");
  const [installations, setInstallations] = useState<number>(0);
  const [inboxId, setInboxId] = useState<string>("");
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<FormattedMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);
  const [error, setError] = useState<string>("");
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null);

  // Function to set error with auto-clear
  const setErrorWithTimeout = (message: string, timeoutMs = 5000) => {
    setError(message);
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    const timeout = setTimeout(() => {
      setError("");
      setErrorTimeout(null);
    }, timeoutMs);
    setErrorTimeout(timeout);
  };
  const streamRef = useRef<AsyncIterable<DecodedMessage> | null>(null);
  const isStreamingRef = useRef(false);

  // Initialize agent
  useEffect(() => {
    const initAgent = async () => {
      let walletKey = process.env.XMTP_CLIENT_WALLET_KEY;
      let dbEncryptionKey = process.env.XMTP_CLIENT_DB_ENCRYPTION_KEY;

      if (!walletKey || !dbEncryptionKey) {
        walletKey = generatePrivateKey();
        dbEncryptionKey = toString(getRandomValues(new Uint8Array(32)), "hex");
      }

      const user = createUser(walletKey as `0x${string}`);
      const signer = createSigner(user);

      // Convert hex string to Uint8Array for dbEncryptionKey
      const encryptionKeyBytes = fromString(dbEncryptionKey, "hex");

      const newAgent = await Agent.create(signer, {
        env,
        dbEncryptionKey: encryptionKeyBytes,
      });

      setAgent(newAgent);
      setAddress(newAgent.address || "");
      setInboxId(newAgent.client.inboxId);
      setUrl(getTestUrl(newAgent.client) || "");

      const finalInboxState = await Client.inboxStateFromInboxIds(
        [newAgent.client.inboxId],
        env,
      );
      setInstallations(finalInboxState[0].installations.length);
      // Sync conversations
      await newAgent.client.conversations.sync();
      const convList = await newAgent.client.conversations.list();
      setConversations(convList);

      // If agent identifiers provided, create/find conversation
      if (agentIdentifiers && agentIdentifiers.length > 0) {
        const conv = await findOrCreateConversation(newAgent, agentIdentifiers);
        if (conv) {
          setCurrentConversation(conv);
          await loadMessages(conv, newAgent);
          await startMessageStream(conv, newAgent);
        }
      }
    };

    initAgent().catch((err) => {
      handleError(err, setError, "Failed to initialize");
    });
  }, []);

  // Find or create conversation
  const findOrCreateConversation = async (
    agentInstance: Agent,
    identifiers: string[],
  ): Promise<Conversation | null> => {
    const client = agentInstance.client;
    const groupOptions = {
      groupName: "CLI Group Chat",
      groupDescription: "Group created from CLI",
    };

    try {
      if (identifiers.length > 1) {
        // Create group
        const allEthAddresses = identifiers.every(isEthAddress);

        if (allEthAddresses) {
          const memberIdentifiers = identifiers.map((id) => ({
            identifier: id,
            identifierKind: IdentifierKind.Ethereum,
          }));
          return await client.conversations.newGroupWithIdentifiers(
            memberIdentifiers,
            groupOptions,
          );
        }

        return await client.conversations.newGroup(identifiers, groupOptions);
      }

      // Create/find DM
      const identifier = identifiers[0];

      // Try to find existing conversation
      await client.conversations.sync();
      const convs = await client.conversations.list();

      for (const conv of convs) {
        if (!isDm(conv)) continue;

        if (conv.peerInboxId.toLowerCase() === identifier.toLowerCase()) {
          return conv;
        }

        if (isEthAddress(identifier)) {
          const members = await conv.members();
          const foundMember = members.find((member) => {
            const ethId = member.accountIdentifiers.find(
              (id) => id.identifierKind === IdentifierKind.Ethereum,
            );
            return ethId?.identifier.toLowerCase() === identifier.toLowerCase();
          });

          if (foundMember) return conv;
        }
      }

      // Create new DM
      return isEthAddress(identifier)
        ? await client.conversations.newDmWithIdentifier({
            identifier,
            identifierKind: IdentifierKind.Ethereum,
          })
        : await client.conversations.newDm(identifier);
    } catch (err: unknown) {
      handleError(err, setError, "Failed to create conversation");
      return null;
    }
  };

  // Load messages
  const loadMessages = async (conv: Conversation, agentInstance: Agent) => {
    await conv.sync();
    const msgs = await conv.messages();
    const formatted = msgs
      .slice(-50)
      .map((msg) => formatMessage(msg, agentInstance));
    setMessages(formatted);
  };

  // Format message
  const formatMessage = (
    message: DecodedMessage,
    agentInstance: Agent,
  ): FormattedMessage => {
    const timestamp = message.sentAt.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isFromSelf = message.senderInboxId === agentInstance.client.inboxId;
    const sender = isFromSelf
      ? "You"
      : agentInstance.address?.slice(0, 4) +
        "..." +
        agentInstance.address?.slice(-4);

    let content: string;
    if (typeof message.content === "string") {
      content = message.content;
    } else {
      // Try to format JSON nicely, fallback to compact if it fails
      try {
        content = JSON.stringify(message.content, null, 2);
      } catch {
        content = JSON.stringify(message.content);
      }
    }

    return { timestamp, sender, content, isFromSelf };
  };

  // Start message stream
  const startMessageStream = async (
    conv: Conversation,
    agentInstance: Agent,
  ) => {
    if (isStreamingRef.current) return;

    isStreamingRef.current = true;
    const client = agentInstance.client;

    try {
      streamRef.current = await client.conversations.streamAllMessages();

      (async () => {
        if (!streamRef.current) return;

        for await (const message of streamRef.current) {
          if (message.conversationId !== conv.id) continue;

          const formatted = formatMessage(message, agentInstance);
          setMessages((prev) => [...prev, formatted]);
        }
      })().catch((err) => {
        handleError(err, setError, "Stream error");
        isStreamingRef.current = false;
      });
    } catch (err: unknown) {
      handleError(err, setError, "Failed to start stream");
      isStreamingRef.current = false;
    }
  };

  // Command handlers
  const commands = {
    "/exit": () => exit(),
    "/back": () => {
      setCurrentConversation(null);
      setMessages([]);
      setShowConversationList(false);
    },
    "/list": () => setShowConversationList((prev) => !prev),
  };

  const handleChatCommand = async (message: string) => {
    const parts = message.split(" ");
    if (parts.length !== 2) {
      setErrorWithTimeout("Usage: /chat <number>");
      return;
    }

    const index = parseInt(parts[1]) - 1;
    if (isNaN(index) || index < 0 || index >= conversations.length) {
      setErrorWithTimeout("Invalid conversation number");
      return;
    }

    const newConv = conversations[index];
    setCurrentConversation(newConv);
    setShowConversationList(false);

    if (agent) {
      await loadMessages(newConv, agent);
      await startMessageStream(newConv, agent);
    }
  };

  // Handle input submit
  const handleSubmit = async (value: string) => {
    if (!value.trim()) return;

    const message = value.trim();
    setInputValue("");

    // Handle direct commands
    if (commands[message as keyof typeof commands]) {
      commands[message as keyof typeof commands]();
      return;
    }

    // Handle /chat command
    if (message.startsWith("/chat ")) {
      await handleChatCommand(message);
      return;
    }

    // If not in a conversation, try to connect to agent address
    if (!currentConversation) {
      if (agent) {
        try {
          const conv = await findOrCreateConversation(agent, [message]);
          if (conv) {
            setCurrentConversation(conv);
            await loadMessages(conv, agent);
            await startMessageStream(conv, agent);
            return;
          }
        } catch (err: unknown) {
          handleError(err, setError, "Failed to connect to agent");
          return;
        }
      }
      setErrorWithTimeout(
        "No active conversation. Use /list to see available chats or /chat <number> to select one.",
      );
      return;
    }

    // Send message
    if (!agent) {
      setErrorWithTimeout("Agent not initialized");
      return;
    }

    try {
      await currentConversation.send(message);
    } catch (err: unknown) {
      handleError(err, setError, "Failed to send");
    }
  };

  // Show loading state
  if (!agent) {
    return (
      <Box flexDirection="column">
        <Text color={RED}>Initializing XMTP Agent...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Header
        conversation={currentConversation}
        env={env}
        url={url}
        conversations={conversations.length}
        installations={installations}
        address={address}
        inboxId={inboxId}
      />

      {/* Show error inline if present */}
      {error && (
        <Box marginY={1}>
          <StatusBox color={ERROR_RED} borderColor={ERROR_RED}>
            Error: {error}
          </StatusBox>
        </Box>
      )}

      {showConversationList && (
        <ConversationList
          conversations={conversations}
          currentConversationId={currentConversation?.id || null}
        />
      )}

      {currentConversation && <Messages messages={messages} height={10} />}

      <InputBox
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        placeholder={
          currentConversation
            ? "Send a message to the agent"
            : "Enter agent address"
        }
      />

      {!currentConversation && conversations.length > 0 && (
        <InfoText>
          Available commands: /list, /chat &lt;number&gt;, /exit
        </InfoText>
      )}
    </Box>
  );
};

// ============================================================================
// CLI Entry Point
// ============================================================================
function parseArgs(): { env: XmtpEnv; help: boolean; agents?: string[] } {
  const args = process.argv.slice(2);
  let env = (process.env.XMTP_ENV as XmtpEnv) || "production";
  let help = false;
  const agents: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--env" && nextArg) {
      env = nextArg as XmtpEnv;
      i++;
    } else if (arg === "--agent" && nextArg) {
      i++;
      while (i < args.length && !args[i].startsWith("--")) {
        agents.push(args[i]);
        i++;
      }
      i--;
    }
  }

  // Auto-detect agent address if not provided and we're in dev environment
  if (agents.length === 0 && env === "dev") {
    // Try to get agent address from environment or use the known dev agent address
    const autoAgentAddressKey = process.env.XMTP_WALLET_KEY || "";
    const autoAgentAddress = privateKeyToAddress(
      autoAgentAddressKey as `0x${string}`,
    );
    if (autoAgentAddress) {
      agents.push(autoAgentAddress);
    }
    console.log(`🔗 Auto-connecting to agent: ${autoAgentAddress}`);
  }

  return { env, help, agents: agents.length > 0 ? agents : undefined };
}

async function main(): Promise<void> {
  const { env, help, agents } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  render(<App env={env} agentIdentifiers={agents} />);
}

void main();
