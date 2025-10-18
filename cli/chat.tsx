#!/usr/bin/env node
import "dotenv/config";
import React, { useState, useEffect } from "react";
import { render, Box, Text } from "ink";
import Spinner from "ink-spinner";
import { XmtpClient } from "./xmtp-client.js";
import { Header } from "./components/Header.js";
import { ConversationList } from "./components/ConversationList.js";
import { ChatView } from "./components/ChatView.js";
import type { Conversation, XmtpEnv } from "./types.js";
import { RED } from "./constants.js";

interface AppProps {
  env: XmtpEnv;
  agentIdentifiers?: string[];
}

const App: React.FC<AppProps> = ({ env, agentIdentifiers }) => {
  const [client] = useState(() => new XmtpClient(env));
  const [loading, setLoading] = useState(true);
  const [clientInfo, setClientInfo] = useState<{
    address: string;
    inboxId: string;
    conversationCount: number;
    installationCount: number;
  } | null>(null);
  const [currentView, setCurrentView] = useState<"home" | "list" | "chat">(
    "home",
  );
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);

  // Initialize client
  useEffect(() => {
    const init = async () => {
      try {
        await client.initialize();
        const info = await client.getClientInfo();
        setClientInfo(info);

        // If agent identifiers provided, create/find conversation
        if (agentIdentifiers && agentIdentifiers.length > 0) {
          let conversation: Conversation;

          if (agentIdentifiers.length > 1) {
            conversation = await client.createGroup(agentIdentifiers);
          } else {
            conversation = await client.findOrCreateDm(agentIdentifiers[0]);
          }

          const convos = await client.getConversations();
          setAllConversations(convos);
          setCurrentConversation(conversation);
          setCurrentView("chat");
        }
      } catch (error) {
        console.error("Failed to initialize:", error);
        process.exit(1);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [client, agentIdentifiers]);

  const handleSelectConversation = async (index: number) => {
    const convos = await client.getConversations();
    setAllConversations(convos);

    if (index >= 0 && index < convos.length) {
      setCurrentConversation(convos[index]);
      setCurrentView("chat");
    }
  };

  const handleBack = () => {
    setCurrentConversation(null);
    setCurrentView("home");
  };

  const handleExit = () => {
    process.exit(0);
  };

  const handleShowConversations = async () => {
    // Refresh and show conversation list
    const convos = await client.getConversations();
    setAllConversations(convos);
    setCurrentView("list");
  };

  if (loading) {
    return (
      <Box padding={1}>
        <Text color={RED}>
          <Spinner type="dots" />
        </Text>
        <Text> Initializing XMTP Client...</Text>
      </Box>
    );
  }

  if (!clientInfo) {
    return (
      <Box padding={1}>
        <Text color={RED}>Error: Failed to load client info</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        address={clientInfo.address}
        inboxId={clientInfo.inboxId}
        conversationCount={clientInfo.conversationCount}
        installationCount={clientInfo.installationCount}
        env={env}
      />

      {currentView === "home" && (
        <ChatView
          client={client}
          conversation={null}
          onBack={handleBack}
          onExit={handleExit}
          onShowConversations={handleShowConversations}
          onSwitchConversation={handleSelectConversation}
        />
      )}

      {currentView === "list" && (
        <ConversationList
          client={client}
          onSelect={handleSelectConversation}
          onQuit={handleBack}
        />
      )}

      {currentView === "chat" && currentConversation && (
        <ChatView
          client={client}
          conversation={currentConversation}
          onBack={handleBack}
          onExit={handleExit}
          onShowConversations={handleShowConversations}
          onSwitchConversation={handleSelectConversation}
        />
      )}
    </Box>
  );
};

// Parse command line arguments
function parseArgs(): {
  env: XmtpEnv;
  help: boolean;
  agents?: string[];
} {
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

  return { env, help, agents: agents.length > 0 ? agents : undefined };
}

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
  --env <environment>    XMTP environment (local, dev, production)
                        [default: production or XMTP_ENV]
  -h, --help            Show this help message

IN-CHAT COMMANDS:
  /conversations         List all your conversations with numbers
  /chat <number>         Switch to a different conversation
  /back                  Return to conversation list
  /exit                  Quit the application

EXAMPLES:
  yarn chat
  yarn chat --env dev
  yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2
  yarn chat --agent 0x7c40611372d354799d138542e77243c284e460b2 0x1234567890abcdef1234567890abcdef12345678

ENVIRONMENT VARIABLES:
  XMTP_ENV                      Default environment
  XMTP_CLIENT_WALLET_KEY        Wallet private key (required)
  XMTP_CLIENT_DB_ENCRYPTION_KEY Database encryption key (required)
`);
}

// Main entry point
async function main(): Promise<void> {
  const { env, help, agents } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  render(<App env={env} agentIdentifiers={agents} />);
}

main();
