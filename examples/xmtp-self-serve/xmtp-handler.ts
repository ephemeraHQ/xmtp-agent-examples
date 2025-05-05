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
  encryptionKey?: string;
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
const WATCHDOG_RESTART_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_AGENT_OPTIONS: AgentOptions[] = [
  {
    walletKey: "",
    encryptionKey: "",
    publicKey: "",
    acceptGroups: false,
    acceptTypes: ["text"],
    networks: ["dev", "production"],
    connectionTimeout: 30000,
    autoReconnect: true,
  },
];

// Helper functions
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Initialize XMTP clients with robust error handling
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  options: AgentOptions[] = DEFAULT_AGENT_OPTIONS,
): Promise<Client[]> => {
  /**
   * Core message streaming function with robust error handling
   */
  const streamMessages = async (
    client: Client,
    callBack: MessageHandler,
    options: AgentOptions,
    onActivity?: () => void,
  ): Promise<void> => {
    const env = client.options?.env ?? "undefined";
    let retryCount = 0;
    const acceptTypes = options.acceptTypes || ["text"];
    let backoffTime = RETRY_DELAY_MS;

    // Main stream loop - never exits
    while (true) {
      try {
        // Reset backoff time if we've been running successfully
        if (retryCount === 0) {
          backoffTime = RETRY_DELAY_MS;
        }

        // Notify activity monitor
        if (onActivity) onActivity();

        const streamPromise = client.conversations.streamAllMessages();
        const stream = await streamPromise;

        console.log(`[${env}] Waiting for messages...`);

        for await (const message of stream) {
          try {
            // Notify activity monitor on each message
            if (onActivity) onActivity();
            // Skip messages from self or with unsupported content types
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

            console.log(
              `[${env}] Received message: ${message.content as string} from ${message.senderInboxId}`,
            );

            const isDm = conversation instanceof Dm;
            if (options.welcomeMessage && isDm) {
              const sent = await sendWelcomeMessage(
                client,
                conversation,
                options.welcomeMessage,
              );
              if (sent) {
                console.log(`[${env}] Welcome message sent, skipping`);
                continue;
              }
            }

            if (isDm || options.acceptGroups) {
              try {
                await messageHandler(client, conversation, message, isDm);
              } catch (handlerError) {
                console.error(
                  `[${env}] Error in message handler:`,
                  handlerError,
                );
              }
            } else {
              console.log(
                `[${env}] Conversation is not a DM and acceptGroups=false, skipping`,
              );
            }

            // Notify activity monitor after processing
            if (onActivity) onActivity();
          } catch (error) {
            // Handle errors within message processing without breaking the stream
            console.error(`[${env}] Error processing message:`, error);

            // Still notify activity monitor even on errors
            if (onActivity) onActivity();
          }
        }

        // If we get here, stream ended normally - reset retry count
        retryCount = 0;
      } catch (error) {
        console.error(`[${env}] Stream error:`, error);
        retryCount++;

        // Notify activity monitor
        if (onActivity) onActivity();

        // If error seems fatal (connection, auth issues), try to recreate client
        if (retryCount > MAX_RETRIES) {
          console.error(
            `[${env}] Max retries (${MAX_RETRIES}) reached for stream. Attempting recovery...`,
          );

          try {
            await initializeClient(messageHandler, [
              { ...options, networks: [env] },
            ]);
            retryCount = 0; // Reset retry counter after recovery
            continue;
          } catch (fatalError) {
            console.error(
              `[${env}] Recovery failed, will try again in 30 seconds:`,
              fatalError,
            );
            await sleep(30000); // Wait 30 seconds before trying again
            retryCount = 0; // Reset retry counter for fresh start
            continue;
          }
        }

        // Try to re-sync conversations before retrying
        try {
          await client.conversations.sync();
        } catch (syncError) {
          console.error(`[${env}] Sync error:`, syncError);
        }

        // Use exponential backoff with jitter
        backoffTime = Math.min(backoffTime * 1.5, 60000); // Cap at 1 minute
        const jitter = Math.random() * 0.3 * backoffTime; // 0-30% jitter
        const waitTime = backoffTime + jitter;

        console.log(
          `[${env}] Retrying in ${Math.round(waitTime / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
        );
        await sleep(waitTime);
      }
    }
  };

  // Setup watchdog to detect stale connections
  const setupWatchdog = (
    client: Client,
    env: string,
    restartFn: () => Promise<void>,
  ) => {
    // If no restart interval is set, don't set up the watchdog
    if (!WATCHDOG_RESTART_INTERVAL_MS) return;

    let lastRestartTimestamp = Date.now();
    // We'll still track activity for logging purposes
    let lastActivityTimestamp = Date.now();
    const updateActivity = () => {
      lastActivityTimestamp = Date.now();
    };

    const watchdogInterval = setInterval(
      () => {
        const currentTime = Date.now();
        const timeSinceLastRestart = currentTime - lastRestartTimestamp;
        const inactiveTime = currentTime - lastActivityTimestamp;

        // Force restart every WATCHDOG_RESTART_INTERVAL_MS regardless of activity
        if (timeSinceLastRestart > WATCHDOG_RESTART_INTERVAL_MS) {
          console.log(
            `[${env}] Watchdog: Scheduled restart after ${Math.round(timeSinceLastRestart / 1000)}s (inactive for ${Math.round(inactiveTime / 1000)}s)`,
          );

          restartFn()
            .then(() => {
              console.log(
                `[${env}] Watchdog: Connection restarted successfully`,
              );
              lastRestartTimestamp = Date.now();
            })
            .catch((error: unknown) => {
              console.error(`[${env}] Watchdog: Failed to restart:`, error);
            })
            .finally(() => {
              updateActivity();
            });
        }
      },
      Math.min(WATCHDOG_RESTART_INTERVAL_MS), // Check every WATCHDOG_RESTART_INTERVAL_MS
    );

    process.on("beforeExit", () => {
      clearInterval(watchdogInterval);
    });
    return updateActivity;
  };

  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];

  for (const option of options) {
    for (const env of option.networks ?? ["dev", "production"]) {
      try {
        console.log(`[${env}] Initializing client...`);

        const signer = createSigner(option.walletKey);
        const dbEncryptionKey = getEncryptionKeyFromHex(
          option.encryptionKey ??
            process.env.ENCRYPTION_KEY ??
            generateEncryptionKeyHex(),
        );
        const loggingLevel = (process.env.LOGGING_LEVEL ?? "off") as LogLevel;
        const signerIdentifier = (await signer.getIdentifier()).identifier;

        const client = await Client.create(signer, {
          dbEncryptionKey,
          env: env as XmtpEnv,
          loggingLevel,
          dbPath: getDbPath(`${env}-${signerIdentifier}`),
          codecs: option.codecs,
        });

        await client.conversations.sync();
        clients.push(client);

        // Create restart function & watchdog
        const restartStream = () =>
          client.conversations
            .sync()
            .then(() => {
              console.log(`[${env}] Forced re-sync completed`);
            })
            .catch((error: unknown) => {
              console.error(`[${env}] Force re-sync failed:`, error);
            });

        const activityTracker = setupWatchdog(client, env, restartStream);

        // Start message streaming
        const streamPromise = streamMessages(
          client,
          messageHandler,
          { ...option, networks: [env] },
          activityTracker,
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

export const sendWelcomeMessage = async (
  client: Client,
  conversation: Conversation,
  welcomeMessage: string,
) => {
  // Get all messages from this conversation
  await conversation.sync();
  const messages = await conversation.messages();
  // Check if we have sent any messages in this conversation before
  const sentMessagesBefore = messages.filter(
    (msg) => msg.senderInboxId.toLowerCase() === client.inboxId.toLowerCase(),
  );
  // If we haven't sent any messages before, send a welcome message and skip validation for this message
  if (sentMessagesBefore.length === 0) {
    console.log(`Sending welcome message`);
    await conversation.send(welcomeMessage);
    return true;
  }
  return false;
};
