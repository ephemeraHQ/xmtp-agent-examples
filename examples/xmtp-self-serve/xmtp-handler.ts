import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "@helpers/client";
import {
  Client,
  Dm,
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type LogLevel,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import "dotenv/config";

/**
 * Configuration options for the XMTP agent
 */
interface AgentOptions {
  walletKey: string;
  /** Whether to accept group conversations */
  acceptGroups?: boolean;
  /** Encryption key for the client */
  dbEncryptionKey?: string;
  /** Networks to connect to (default: ['dev', 'production']) */
  networks?: string[];
  /** Public key of the agent */
  publicKey?: string;
  /** Content types to accept (default: ['text']) */
  acceptTypes?: string[];
  /** Connection timeout in ms (default: 30000) */
  connectionTimeout?: number;
  /** Whether to auto-reconnect on fatal errors (default: true) */
  autoReconnect?: boolean;
  /** Welcome message to send to the conversation */
  welcomeMessage?: string;
  /** Codecs to use */
  codecs?: any[];
}

/**
 * Message handler callback type
 */
type MessageHandler = (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
) => Promise<void> | void;

// Constants
const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 2000;
const WATCHDOG_INTERVAL_MS = 0.5 * 60 * 1000;
const NULL_ADDRESS = "0x462Da2cfe4662D1C41C2c08872c0f02F3725cD42";
const DEFAULT_AGENT_OPTIONS: AgentOptions = {
  walletKey: "",
  dbEncryptionKey: process.env.ENCRYPTION_KEY ?? generateEncryptionKeyHex(),
  publicKey: "",
  acceptGroups: false,
  acceptTypes: ["text"],
  networks: process.env.XMTP_ENV ? [process.env.XMTP_ENV] : ["dev"],
  connectionTimeout: 30000,
  autoReconnect: true,
  welcomeMessage: "",
  codecs: [],
};

// Helper functions
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Initialize XMTP clients with robust error handling
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  options: AgentOptions[],
): Promise<Client[]> => {
  const mergedOptions = options.map((opt) => ({
    ...DEFAULT_AGENT_OPTIONS,
    ...opt,
  }));
  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];

  for (const option of mergedOptions) {
    for (const env of option.networks ?? []) {
      try {
        console.log(`[${env}] Initializing client...`);
        const client = await createClientInstance(option, env);
        await client.conversations.sync();
        clients.push(client);

        // Health check and activity state
        const healthState = {
          lastActivity: Date.now(),
          lastRestart: Date.now(),
          isAliveCheck: { pending: false, received: false },
        };

        // Start message streaming
        const streamPromise = handleMessages(
          client,
          messageHandler,
          option,
          healthState,
        );
        streamPromises.push(streamPromise);
      } catch (error) {
        console.error(`[${env}] Client initialization error:`, error);
      }
    }
  }

  logAgentDetails(clients);
  await Promise.all(streamPromises);
  return clients;
};

const createClientInstance = async (
  option: AgentOptions,
  env: string,
): Promise<Client> => {
  const signer = createSigner(option.walletKey);
  const dbEncryptionKey = getEncryptionKeyFromHex(
    option.dbEncryptionKey ??
      process.env.ENCRYPTION_KEY ??
      generateEncryptionKeyHex(),
  );
  const loggingLevel = (process.env.LOGGING_LEVEL ?? "off") as LogLevel;
  const signerIdentifier = (await signer.getIdentifier()).identifier;

  return Client.create(signer, {
    dbEncryptionKey,
    env: env as XmtpEnv,
    loggingLevel,
    dbPath: getDbPath(`${env}-${signerIdentifier}`),
    codecs: option.codecs ?? [],
  });
};

const handleMessages = async (
  client: Client,
  messageHandler: MessageHandler,
  options: AgentOptions,
  healthState: {
    lastActivity: number;
    lastRestart: number;
    isAliveCheck: { pending: boolean; received: boolean };
  },
): Promise<void> => {
  const env = client.options?.env || "unknown";
  let retryCount = 0;
  let backoffTime = RETRY_DELAY_MS;
  const acceptTypes = options.acceptTypes || ["text"];

  // Setup watchdog if enabled
  if (shouldSetupWatchdog(env)) {
    setupWatchdog(client, env, healthState);
  }

  // Main stream loop
  while (true) {
    try {
      if (retryCount === 0) backoffTime = RETRY_DELAY_MS;
      healthState.lastActivity = Date.now();

      const stream = await client.conversations.streamAllMessages();
      console.log(`[${env}] Waiting for messages...`);

      for await (const message of stream) {
        try {
          healthState.lastActivity = Date.now();

          // Handle isAlive checks
          if (handleIsAliveCheck(message, client, healthState)) continue;

          // Skip self messages or unsupported content types
          if (
            !message ||
            message.senderInboxId.toLowerCase() ===
              client.inboxId.toLowerCase() ||
            !acceptTypes.includes(message.contentType?.typeId ?? "text")
          ) {
            continue;
          }

          const conversation = await client.conversations.getConversationById(
            message.conversationId,
          );
          if (!conversation) {
            console.log(`[${env}] Unable to find conversation, skipping`);
            continue;
          }

          const isDm = conversation instanceof Dm;

          // Handle welcome message for new DMs
          if (
            options.welcomeMessage &&
            isDm &&
            (await sendWelcomeMessage(
              client,
              conversation,
              options.welcomeMessage,
            ))
          ) {
            continue;
          }

          // Process message if it's a DM or groups are accepted
          if (isDm || options.acceptGroups) {
            try {
              await messageHandler(client, conversation, message, isDm);
            } catch (handlerError) {
              const errorMessage =
                handlerError instanceof Error
                  ? handlerError.message
                  : String(handlerError);
              console.error(`[${env}] Error in message handler:`, errorMessage);
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`[${env}] Error processing message:`, errorMessage);
        }
      }

      retryCount = 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[${env}] Stream error:`, errorMessage);
      retryCount++;
      healthState.lastActivity = Date.now();

      if (retryCount > MAX_RETRIES) {
        await handleMaxRetries(client, messageHandler, options, env);
        retryCount = 0;
        continue;
      }

      try {
        await client.conversations.sync();
      } catch (syncError) {
        const syncErrorMessage =
          syncError instanceof Error ? syncError.message : String(syncError);
        console.error(`[${env}] Sync error:`, syncErrorMessage);
      }

      // Backoff with jitter
      const waitTime = calculateBackoff(backoffTime);
      console.log(
        `[${env}] Retrying in ${Math.round(waitTime / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
      );
      await sleep(waitTime);
    }
  }
};

const shouldSetupWatchdog = (env?: string): boolean => {
  return (
    !!WATCHDOG_INTERVAL_MS &&
    env !== "local" &&
    (env === "dev" || env === "production")
  );
};

const setupWatchdog = (
  client: Client,
  env: string,
  healthState: {
    lastActivity: number;
    lastRestart: number;
    isAliveCheck: { pending: boolean; received: boolean };
  },
): void => {
  setInterval(() => {
    const now = Date.now();
    const timeSinceRestart = now - healthState.lastRestart;

    if (timeSinceRestart > WATCHDOG_INTERVAL_MS) {
      console.log(`[${env}] Watchdog: Performing isAlive check...`);

      void (async () => {
        const isAlive = await checkIsAlive(client, env, healthState);

        if (!isAlive) {
          console.log(
            `[${env}] Watchdog: isAlive check failed, restarting connection`,
          );
          await restartConnection(client, env);
          healthState.lastRestart = Date.now();
        } else {
          console.log(`[${env}] Watchdog: isAlive check passed`);
          healthState.lastRestart = Date.now();
        }
      })();
    }
  }, WATCHDOG_INTERVAL_MS);
};

const handleIsAliveCheck = (
  message: DecodedMessage | undefined,
  client: Client,
  healthState: { isAliveCheck: { pending: boolean; received: boolean } },
): boolean => {
  if (
    healthState.isAliveCheck.pending &&
    message &&
    message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() &&
    message.content === "isAlive-check"
  ) {
    healthState.isAliveCheck.received = true;
    return true;
  }
  return false;
};

const checkIsAlive = async (
  client: Client,
  env: string,
  healthState: { isAliveCheck: { pending: boolean; received: boolean } },
): Promise<boolean> => {
  try {
    healthState.isAliveCheck.received = false;
    healthState.isAliveCheck.pending = true;

    const conversation = await client.conversations.newDmWithIdentifier({
      identifier: NULL_ADDRESS,
      identifierKind: IdentifierKind.Ethereum,
    });

    await conversation.send("isAlive-check");

    // Wait for response
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      if (healthState.isAliveCheck.received) {
        healthState.isAliveCheck.pending = false;
        return true;
      }
      await sleep(100);
    }

    healthState.isAliveCheck.pending = false;
    return false;
  } catch (error) {
    healthState.isAliveCheck.pending = false;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${env}] Error in isAlive check:`, errorMessage);
    return false;
  }
};

const restartConnection = async (
  client: Client,
  env: string,
): Promise<void> => {
  try {
    await client.conversations.sync();
    console.log(`[${env}] Forced re-sync completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${env}] Force re-sync failed:`, errorMessage);
  }
};

const handleMaxRetries = async (
  client: Client,
  messageHandler: MessageHandler,
  options: AgentOptions,
  env: string = "unknown",
): Promise<void> => {
  console.error(`[${env}] Max retries reached. Attempting recovery...`);

  try {
    await initializeClient(messageHandler, [{ ...options }]);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[${env}] Recovery failed, will try again in 30s:`,
      errorMessage,
    );
    await sleep(30000);
  }
};

const calculateBackoff = (baseTime: number): number => {
  const newBackoff = Math.min(baseTime * 1.5, 60000);
  const jitter = Math.random() * 0.3 * newBackoff;
  return newBackoff + jitter;
};

export const sendWelcomeMessage = async (
  client: Client,
  conversation: Conversation,
  welcomeMessage: string,
): Promise<boolean> => {
  await conversation.sync();
  const messages = await conversation.messages();

  // Check if we've sent any messages before
  const hasSentBefore = messages.some(
    (msg) => msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
  );

  if (!hasSentBefore) {
    await conversation.send(welcomeMessage);
    return true;
  }
  return false;
};
