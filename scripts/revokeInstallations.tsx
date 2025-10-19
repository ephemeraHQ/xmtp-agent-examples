import "dotenv/config";
import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type XmtpEnv } from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { Client } from "@xmtp/node-sdk";

// Check Node.js version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split(".").map(Number);
if (major < 20) {
  console.error("Error: Node.js version 20 or higher is required");
  process.exit(1);
}

// ============================================================================
// Types and Interfaces
// ============================================================================
interface Installation {
  id: string;
  bytes: Uint8Array;
}

interface EnvVars {
  XMTP_WALLET_KEY: string;
  XMTP_DB_ENCRYPTION_KEY: string;
  XMTP_ENV: string;
}

interface RevokeState {
  step: 'loading' | 'input' | 'selecting' | 'confirming' | 'revoking' | 'success' | 'error';
  inboxId: string;
  envVars: EnvVars | null;
  installations: Installation[];
  selectedInstallations: string[];
  installationsToKeep: string[];
  error: string;
  progress: number;
}

// ============================================================================
// Utility Functions
// ============================================================================
const validateInboxId = (inboxId: string): boolean => {
  return /^[a-f0-9]{64}$/i.test(inboxId);
};

const validateInstallationId = (id: string): boolean => {
  return /^[a-f0-9]{64}$/i.test(id);
};

const loadEnvVars = async (): Promise<EnvVars | null> => {
  const exampleDir = process.cwd();
  const envPath = join(exampleDir, ".env");

  if (!existsSync(envPath)) {
    return null;
  }

  const envContent = await readFile(envPath, "utf-8");
  const envVars: Record<string, string> = {};

  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value && !key.startsWith("#")) {
      envVars[key.trim()] = value.trim();
    }
  });

  const requiredVars = ["XMTP_WALLET_KEY", "XMTP_DB_ENCRYPTION_KEY", "XMTP_ENV"];
  const missingVars = requiredVars.filter((varName) => !envVars[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
  }

  return envVars as EnvVars;
};

// ============================================================================
// UI Components
// ============================================================================
const RED = "#fc4c34";
const GREEN = "#00ff00";
const YELLOW = "#ffff00";
const BLUE = "#0099ff";

interface StatusBoxProps {
  children: React.ReactNode;
  color?: string;
  borderColor?: string;
}

const StatusBox: React.FC<StatusBoxProps> = ({
  children,
  color = RED,
  borderColor = RED,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box borderStyle="round" borderColor={borderColor} padding={1}>
        <Text color={color}>{children}</Text>
      </Box>
    </Box>
  );
};

interface ProgressBarProps {
  progress: number;
  color?: string;
  width?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  color = BLUE, 
  width = 30 
}) => {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  
  return (
    <Box>
      <Text color={color}>
        {Array(filled).fill("█").join("")}
        {Array(empty).fill("░").join("")}
      </Text>
      <Text> {progress.toFixed(0)}%</Text>
    </Box>
  );
};

interface InstallationListProps {
  installations: Installation[];
  selectedInstallations: string[];
  onToggle: (id: string) => void;
  installationsToKeep: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}

const InstallationList: React.FC<InstallationListProps> = ({
  installations,
  selectedInstallations,
  onToggle,
  installationsToKeep,
  selectedIndex,
  onSelectIndex,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color={RED}>Available Installations (use ↑↓ to navigate, Space to toggle, Enter to proceed):</Text>
      {installations.map((inst, index) => {
        const isSelected = selectedInstallations.includes(inst.id);
        const isProtected = installationsToKeep.includes(inst.id);
        const isHighlighted = index === selectedIndex;
        const status = isProtected ? "🔒" : isSelected ? "✅" : "⭕";
        const color = isProtected ? YELLOW : isSelected ? GREEN : isHighlighted ? BLUE : undefined;
        const background = isHighlighted ? " inverse" : "";
        
        return (
          <Box key={inst.id} marginY={0.5}>
            <Text color={color} inverse={isHighlighted}>
              {status} {index + 1}. {inst.id.slice(0, 16)}...{inst.id.slice(-8)}
              {isProtected && " (PROTECTED)"}
              {isHighlighted && " ←"}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

// ============================================================================
// Main App Component
// ============================================================================
interface RevokeAppProps {
  inboxId?: string;
  installationsToKeep?: string[];
}

const RevokeApp: React.FC<RevokeAppProps> = ({ inboxId: initialInboxId, installationsToKeep: initialInstallationsToKeep }) => {
  const { exit } = useApp();
  const [state, setState] = useState<RevokeState>({
    step: 'loading',
    inboxId: initialInboxId || '',
    envVars: null,
    installations: [],
    selectedInstallations: [],
    installationsToKeep: initialInstallationsToKeep || [],
    error: '',
    progress: 0,
  });

  const [inputValue, setInputValue] = useState(initialInboxId || '');
  const [confirmInput, setConfirmInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Initialize the app
  useEffect(() => {
    const initialize = async () => {
      try {
        const envVars = await loadEnvVars();
        setState(prev => ({ ...prev, envVars, step: 'input' }));
        
        if (initialInboxId && validateInboxId(initialInboxId)) {
          await loadInstallations(initialInboxId, envVars!);
        }
      } catch (error) {
        setState(prev => ({ 
          ...prev, 
          error: error instanceof Error ? error.message : String(error),
          step: 'error' 
        }));
      }
    };

    initialize();
  }, []);

  const loadInstallations = async (inboxId: string, envVars: EnvVars) => {
    setState(prev => ({ ...prev, step: 'loading', progress: 25 }));
    
    try {
      const signer = createSigner(createUser(envVars.XMTP_WALLET_KEY as `0x${string}`));
      
      setState(prev => ({ ...prev, progress: 50 }));
      
      const inboxState = await Client.inboxStateFromInboxIds(
        [inboxId],
        envVars.XMTP_ENV as XmtpEnv,
      );
      
      setState(prev => ({ ...prev, progress: 75 }));
      
      const installations = inboxState[0].installations.map(inst => ({
        id: inst.id,
        bytes: inst.bytes,
      }));
      
      setState(prev => ({ 
        ...prev, 
        installations,
        inboxId,
        progress: 100,
        step: installations.length <= 1 ? 'success' : 'selecting'
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : String(error),
        step: 'error' 
      }));
    }
  };

  const handleInboxIdSubmit = async () => {
    if (!validateInboxId(inputValue)) {
      setState(prev => ({ ...prev, error: 'Invalid inbox ID format. Must be 64 hexadecimal characters.' }));
      return;
    }
    
    if (!state.envVars) {
      setState(prev => ({ ...prev, error: 'Environment variables not loaded.' }));
      return;
    }
    
    await loadInstallations(inputValue, state.envVars);
  };

  const toggleInstallation = (id: string) => {
    setState(prev => ({
      ...prev,
      selectedInstallations: prev.selectedInstallations.includes(id)
        ? prev.selectedInstallations.filter(selected => selected !== id)
        : [...prev.selectedInstallations, id]
    }));
  };

  const handleRevoke = async () => {
    if (!state.envVars || state.selectedInstallations.length === 0) return;
    
    setState(prev => ({ ...prev, step: 'revoking', progress: 0 }));
    
    try {
      const signer = createSigner(createUser(state.envVars.XMTP_WALLET_KEY as `0x${string}`));
      const installationsToRevoke = state.installations.filter(
        inst => state.selectedInstallations.includes(inst.id)
      );
      
      setState(prev => ({ ...prev, progress: 50 }));
      
      await Client.revokeInstallations(
        signer,
        state.inboxId,
        installationsToRevoke.map(inst => inst.bytes),
        state.envVars.XMTP_ENV as XmtpEnv,
      );
      
      setState(prev => ({ ...prev, progress: 100, step: 'success' }));
      
      // Auto-exit after success
      setTimeout(() => exit(), 3000);
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : String(error),
        step: 'error' 
      }));
    }
  };

  const renderStep = () => {
    switch (state.step) {
      case 'loading':
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color={BLUE}>
              <Spinner type="dots" /> Loading installations...
            </Text>
            <Box marginTop={1}>
              <ProgressBar progress={state.progress} />
            </Box>
          </Box>
        );

      case 'input':
        return (
          <Box flexDirection="column">
            <Text bold color={RED}>XMTP Installation Revocation Tool</Text>
            <Box marginY={1}>
              <Text>Enter inbox ID (64 hex characters):</Text>
            </Box>
            <Box marginY={1}>
              <TextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleInboxIdSubmit}
                placeholder="743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64"
              />
            </Box>
            <Box marginY={1}>
              <Text dimColor>Press Enter to continue</Text>
            </Box>
          </Box>
        );

      case 'selecting':
        const canProceed = state.selectedInstallations.length > 0 && 
                          state.selectedInstallations.length < state.installations.length;
        
        return (
          <Box flexDirection="column">
            <Text bold color={RED}>Select Installations to Revoke</Text>
            <Box marginY={1}>
              <Text>Inbox ID: {state.inboxId.slice(0, 16)}...{state.inboxId.slice(-8)}</Text>
              <Text>Environment: {state.envVars?.XMTP_ENV}</Text>
              <Text>Total installations: {state.installations.length}</Text>
            </Box>
            
            <InstallationList
              installations={state.installations}
              selectedInstallations={state.selectedInstallations}
              onToggle={toggleInstallation}
              installationsToKeep={state.installationsToKeep}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
            
            <Box marginY={1}>
              <Text>Selected for revocation: {state.selectedInstallations.length}</Text>
              <Text>Will keep: {state.installations.length - state.selectedInstallations.length}</Text>
            </Box>
            
            {canProceed && (
              <Box marginY={1}>
                <Text color={GREEN}>Press Enter to proceed with revocation</Text>
              </Box>
            )}
            
            <Box marginY={1}>
              <Text dimColor>Commands: Enter (proceed) | Ctrl+C (exit)</Text>
            </Box>
          </Box>
        );

      case 'confirming':
        return (
          <Box flexDirection="column">
            <Text bold color={YELLOW}>⚠️  Final Confirmation</Text>
            <Box marginY={1}>
              <Text>You are about to revoke {state.selectedInstallations.length} installations:</Text>
            </Box>
            {state.selectedInstallations.map(id => (
              <Box key={id}>
                <Text color={RED}>• {id.slice(0, 16)}...{id.slice(-8)}</Text>
              </Box>
            ))}
            <Box marginY={1}>
              <Text>Type "REVOKE" to confirm:</Text>
            </Box>
            <Box marginY={1}>
              <TextInput
                value={confirmInput}
                onChange={setConfirmInput}
                onSubmit={(value) => {
                  if (value.toUpperCase() === 'REVOKE') {
                    handleRevoke();
                  } else {
                    setState(prev => ({ ...prev, error: 'Invalid confirmation. Type "REVOKE" exactly.' }));
                  }
                }}
                placeholder="REVOKE"
              />
            </Box>
          </Box>
        );

      case 'revoking':
        return (
          <Box flexDirection="column" alignItems="center">
            <Text color={BLUE}>
              <Spinner type="dots" /> Revoking installations...
            </Text>
            <Box marginTop={1}>
              <ProgressBar progress={state.progress} />
            </Box>
            <Box marginTop={1}>
              <Text>Revoking {state.selectedInstallations.length} installations...</Text>
            </Box>
          </Box>
        );

      case 'success':
        return (
          <Box flexDirection="column" alignItems="center">
            <StatusBox color={GREEN} borderColor={GREEN}>
              ✅ Successfully revoked {state.selectedInstallations.length} installations!
            </StatusBox>
            <Box marginY={1}>
              <Text>Final installations: {state.installations.length - state.selectedInstallations.length}</Text>
            </Box>
            <Box marginY={1}>
              <Text dimColor>Exiting in 3 seconds...</Text>
            </Box>
          </Box>
        );

      case 'error':
        return (
          <Box flexDirection="column">
            <StatusBox color={RED} borderColor={RED}>
              ❌ Error: {state.error}
            </StatusBox>
            <Box marginY={1}>
              <Text color={RED}>Press Ctrl+C to exit</Text>
            </Box>
          </Box>
        );

      default:
        return <Text>Unknown state</Text>;
    }
  };

  // Handle keyboard input for installation selection
  useEffect(() => {
    if (state.step === 'selecting') {
      const handleKeyPress = (ch: any, key: any) => {
        if (key.name === 'up') {
          setSelectedIndex(prev => Math.max(0, prev - 1));
        } else if (key.name === 'down') {
          setSelectedIndex(prev => Math.min(state.installations.length - 1, prev + 1));
        } else if (key.name === 'space') {
          const currentInstallation = state.installations[selectedIndex];
          if (currentInstallation && !state.installationsToKeep.includes(currentInstallation.id)) {
            toggleInstallation(currentInstallation.id);
          }
        } else if (key.name === 'return') {
          if (state.selectedInstallations.length > 0 && 
              state.selectedInstallations.length < state.installations.length) {
            setState(prev => ({ ...prev, step: 'confirming' }));
          }
        }
      };

      process.stdin.on('keypress', handleKeyPress);
      return () => {
        process.stdin.off('keypress', handleKeyPress);
      };
    }
  }, [state.step, state.selectedInstallations, state.installations.length, state.installations, selectedIndex, state.installationsToKeep]);

  return (
    <Box flexDirection="column">
      {renderStep()}
    </Box>
  );
};

// ============================================================================
// CLI Entry Point
// ============================================================================
function parseArgs(): { inboxId?: string; installationsToKeep?: string[]; help: boolean } {
  const args = process.argv.slice(2);
  let help = false;
  let inboxId: string | undefined;
  let installationsToKeep: string[] | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--inbox" && nextArg) {
      inboxId = nextArg;
      i++;
    } else if (arg === "--keep" && nextArg) {
      installationsToKeep = nextArg.split(",").map(id => id.trim()).filter(id => id.length > 0);
      i++;
    }
  }

  // If no --inbox flag, use first positional argument
  if (!inboxId && args.length > 0 && !args[0].startsWith("--")) {
    inboxId = args[0];
    if (args.length > 1 && !args[1].startsWith("--")) {
      installationsToKeep = args[1].split(",").map(id => id.trim()).filter(id => id.length > 0);
    }
  }

  return { inboxId, installationsToKeep, help };
}

function showHelp(): void {
  console.log(`
XMTP Installation Revocation Tool

An interactive tool for revoking XMTP installations with a modern CLI interface.

USAGE:
  yarn revoke [options] [inbox-id] [installations-to-keep]

OPTIONS:
  --inbox <id>           Inbox ID (64 hex characters)
  --keep <ids>           Comma-separated installation IDs to keep
  -h, --help             Show this help message

EXAMPLES:
  yarn revoke
  yarn revoke 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64
  yarn revoke --inbox 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64 --keep "id1,id2"

INTERACTIVE FEATURES:
  • Visual installation browser with selection
  • Real-time progress tracking
  • Interactive confirmation dialogs
  • Enhanced error handling with recovery options
  • Keyboard navigation support

ENVIRONMENT VARIABLES:
  XMTP_WALLET_KEY         Wallet private key (required)
  XMTP_DB_ENCRYPTION_KEY  Database encryption key (required)
  XMTP_ENV                XMTP environment (local, dev, production)
`);
}

async function main(): Promise<void> {
  const { inboxId, installationsToKeep, help } = parseArgs();

  if (help) {
    showHelp();
    process.exit(0);
  }

  // Validate inbox ID if provided
  if (inboxId && !validateInboxId(inboxId)) {
    console.error("Error: Invalid inbox ID format. Must be 64 hexadecimal characters.");
    console.error(`Provided: ${inboxId}`);
    process.exit(1);
  }

  // Validate installation IDs if provided
  if (installationsToKeep && installationsToKeep.length > 0) {
    const invalidInstallations = installationsToKeep.filter(id => !validateInstallationId(id));
    if (invalidInstallations.length > 0) {
      console.error("Error: Invalid installation ID format(s). Must be 64 hexadecimal characters.");
      console.error("Invalid IDs:", invalidInstallations.join(", "));
      process.exit(1);
    }
  }

  render(<RevokeApp inboxId={inboxId} installationsToKeep={installationsToKeep} />);
}

main().catch((error: unknown) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
