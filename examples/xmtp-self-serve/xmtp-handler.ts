import {
  createSigner,
  generateEncryptionKeyHex,
  getDbPath,
  getEncryptionKeyFromHex,
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

// Get environment variable
const XMTP_ENV = process.env.XMTP_ENV || "dev";

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
  /** Worker name (if using worker mode) */
  workerName?: string;
}

/**
 * Worker instance type
 */
interface WorkerInstance {
  name: string;
  client: Client;
  options: AgentOptions;
  isActive: boolean;
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
    networks: [XMTP_ENV],
    connectionTimeout: 30000,
    autoReconnect: true,
  },
];

// Helper functions
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Worker manager to track all workers
class WorkerManager {
  private workers: Map<string, WorkerInstance> = new Map();
  private messageHandler: MessageHandler;

  constructor(messageHandler: MessageHandler) {
    this.messageHandler = messageHandler;
  }

  addWorker(name: string, client: Client, options: AgentOptions): void {
    this.workers.set(name, {
      name,
      client,
      options,
      isActive: true,
    });
  }

  getWorker(name: string): WorkerInstance | undefined {
    return this.workers.get(name);
  }

  getAllWorkers(): WorkerInstance[] {
    return Array.from(this.workers.values());
  }

  getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  terminateWorker(name: string): void {
    const worker = this.workers.get(name);
    if (worker) {
      worker.isActive = false;
      this.workers.delete(name);
    }
  }
}

// Global worker manager instance
let workerManager: WorkerManager | null = null;

/**
 * Initialize a worker manager with a message handler
 */
export const initializeWorkerManager = (
  messageHandler: MessageHandler,
): WorkerManager => {
  if (!workerManager) {
    workerManager = new WorkerManager(messageHandler);
  }
  return workerManager;
};

/**
 * Get the current worker manager or create a new one
 */
export const getWorkerManager = (
  messageHandler?: MessageHandler,
): WorkerManager => {
  if (!workerManager && messageHandler) {
    workerManager = new WorkerManager(messageHandler);
  } else if (!workerManager) {
    throw new Error("Worker manager not initialized");
  }
  return workerManager;
};

/**
 * Initialize XMTP clients with robust error handling and worker support
 */
export const initializeClient = async (
  messageHandler: MessageHandler,
  options: AgentOptions[] = DEFAULT_AGENT_OPTIONS,
): Promise<Client[]> => {
  // Initialize the worker manager with the message handler
  const manager = initializeWorkerManager(messageHandler);

  /**
   * Core message streaming function with robust error handling
   */
  const streamMessages = async (
    client: Client,
    options: AgentOptions,
    onActivity?: () => void,
  ): Promise<void> => {
    const env = client.options?.env ?? XMTP_ENV;
    let retryCount = 0;
    const acceptTypes = options.acceptTypes || ["text"];
    let backoffTime = RETRY_DELAY_MS;
    const workerName = options.workerName || "default";

    // Get the worker instance (or create if not exists)
    let worker = manager.getWorker(workerName);
    if (!worker) {
      manager.addWorker(workerName, client, options);
      worker = manager.getWorker(workerName);

      // If still no worker, exit the function
      if (!worker) {
        console.error(`[${env}] Failed to create worker: ${workerName}`);
        return;
      }
    }

    // Main stream loop - never exits unless worker is terminated
    while (worker.isActive) {
      try {
        // Reset backoff time if we've been running successfully
        if (retryCount === 0) {
          backoffTime = RETRY_DELAY_MS;
        }

        // Notify activity monitor
        if (onActivity) onActivity();

        const stream = await client.conversations.streamAllMessages();

        for await (const message of stream) {
          try {
            // Check if worker is still active
            if (!worker.isActive) break;

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

            if (!conversation) continue;

            const isDm = conversation instanceof Dm;
            if (options.welcomeMessage && isDm) {
              const sent = await sendWelcomeMessage(
                client,
                conversation,
                options.welcomeMessage,
              );
              if (sent) continue;
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
        // Check if worker is still active
        if (!worker.isActive) break;

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
            // Try reinitializing the client
            const newClient = await createClientFromOptions(options);
            manager.addWorker(workerName, newClient, options);
            const updatedWorker = manager.getWorker(workerName);
            if (updatedWorker) {
              worker = updatedWorker;
              retryCount = 0; // Reset retry counter after recovery
              continue;
            } else {
              throw new Error("Failed to get updated worker after recovery");
            }
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

        console.error(
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
    workerName: string,
    restartFn: () => Promise<void>,
  ) => {
    // If no restart interval is set, don't set up the watchdog
    if (!WATCHDOG_RESTART_INTERVAL_MS) return;

    let lastRestartTimestamp = Date.now();
    let _lastActivityTimestamp = Date.now();
    const updateActivity = () => {
      _lastActivityTimestamp = Date.now();
    };

    const watchdogInterval = setInterval(
      () => {
        // Check if worker is still active
        const worker = manager.getWorker(workerName);
        if (!worker || !worker.isActive) {
          clearInterval(watchdogInterval);
          return;
        }

        const currentTime = Date.now();
        const timeSinceLastRestart = currentTime - lastRestartTimestamp;

        // Force restart every WATCHDOG_RESTART_INTERVAL_MS regardless of activity
        if (timeSinceLastRestart > WATCHDOG_RESTART_INTERVAL_MS) {
          restartFn()
            .then(() => {
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

  /**
   * Create a client from agent options
   */
  const createClientFromOptions = async (
    option: AgentOptions,
  ): Promise<Client> => {
    const signer = createSigner(option.walletKey);
    const dbEncryptionKey = getEncryptionKeyFromHex(
      option.encryptionKey ??
        process.env.ENCRYPTION_KEY ??
        generateEncryptionKeyHex(),
    );
    const loggingLevel = (process.env.LOGGING_LEVEL ?? "off") as LogLevel;
    const signerIdentifier = (await signer.getIdentifier()).identifier;
    const workerName = option.workerName || "default";
    const dbPathSuffix = workerName !== "default" ? `-${workerName}` : "";
    // Get env from networks if available, otherwise fall back to XMTP_ENV
    const env = option.networks?.[0] ?? process.env.XMTP_ENV ?? "dev";

    const client = await Client.create(signer, {
      dbEncryptionKey,
      env: env as XmtpEnv,
      loggingLevel,
      dbPath: getDbPath(`${env}-${signerIdentifier}${dbPathSuffix}`),
      codecs: option.codecs,
    });

    await client.conversations.sync();
    return client;
  };

  const clients: Client[] = [];
  const streamPromises: Promise<void>[] = [];
  console.log("Initializing clients...");
  for (const option of options) {
    for (const env of option.networks ?? [XMTP_ENV]) {
      try {
        // Create a network-specific worker name
        const baseWorkerName = option.workerName || "default";
        const workerName = `${baseWorkerName}-${env}`;

        const client = await createClientFromOptions({
          ...option,
          networks: [env],
          workerName, // Use the network-specific worker name
        });

        clients.push(client);

        // Add this client to the worker manager
        manager.addWorker(workerName, client, {
          ...option,
          networks: [env],
          workerName, // Use the network-specific worker name
        });

        // Create restart function & watchdog
        const restartStream = () =>
          client.conversations.sync().catch((error: unknown) => {
            console.error(`[${env}] Force re-sync failed:`, error);
          });

        const activityTracker = setupWatchdog(
          client,
          env,
          workerName,
          restartStream,
        );

        // Start message streaming
        const streamPromise = streamMessages(
          client,
          { ...option, networks: [env] },
          activityTracker,
        );

        streamPromises.push(streamPromise);
        console.log(`[${env}] Streaming messages...`);
      } catch (error) {
        console.error(`[${env}] Client initialization error:`, error);
      }
    }
  }
  logAgentDetails(clients);
  // Don't await these promises as they run indefinitely
  Promise.all(streamPromises).catch((error: unknown) => {
    console.error("Fatal error in stream promises:", error);
  });

  return clients;
};

/**
 * Add a new worker to the system
 */
export const addWorker = async (
  workerName: string,
  options: AgentOptions,
): Promise<Client | null> => {
  if (!workerManager) {
    throw new Error("Worker manager not initialized");
  }

  try {
    // Get the network from options or use default
    const env = options.networks?.[0] ?? XMTP_ENV;
    // Create a network-specific worker name
    const networkWorkerName = `${workerName}-${env}`;

    // Create the client with worker name
    const client = await createClientFromOptions({
      ...options,
      workerName: networkWorkerName,
    });

    // Add to worker manager
    workerManager.addWorker(networkWorkerName, client, {
      ...options,
      workerName: networkWorkerName,
    });

    // Start message streaming for this worker
    streamWorkerMessages(networkWorkerName).catch((error: unknown) => {
      console.error(`Error starting worker ${networkWorkerName}:`, error);
    });

    return client;
  } catch (error) {
    console.error(`Failed to add worker ${workerName}:`, error);
    return null;
  }
};

/**
 * Create a client from agent options
 */
const createClientFromOptions = async (
  options: AgentOptions,
): Promise<Client> => {
  const signer = createSigner(options.walletKey);
  const dbEncryptionKey = getEncryptionKeyFromHex(
    options.encryptionKey ??
      process.env.ENCRYPTION_KEY ??
      generateEncryptionKeyHex(),
  );
  const loggingLevel = (process.env.LOGGING_LEVEL ?? "off") as LogLevel;
  const signerIdentifier = (await signer.getIdentifier()).identifier;
  const workerName = options.workerName || "default";
  const dbPathSuffix = workerName !== "default" ? `-${workerName}` : "";
  // Get env from networks if available, otherwise fall back to XMTP_ENV
  const env = options.networks?.[0] ?? XMTP_ENV;

  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: env as XmtpEnv,
    loggingLevel,
    dbPath: getDbPath(`${env}-${signerIdentifier}${dbPathSuffix}`),
    codecs: options.codecs,
  });

  await client.conversations.sync();
  return client;
};

/**
 * Start message streaming for a specific worker
 */
const streamWorkerMessages = async (workerName: string): Promise<void> => {
  if (!workerManager) {
    throw new Error("Worker manager not initialized");
  }

  const worker = workerManager.getWorker(workerName);
  if (!worker) {
    throw new Error(`Worker ${workerName} not found`);
  }

  // Get worker details and message handler
  const { client, options } = worker;
  const env = client.options?.env ?? XMTP_ENV;
  let retryCount = 0;
  const acceptTypes = options.acceptTypes || ["text"];
  let backoffTime = RETRY_DELAY_MS;
  const messageHandler = workerManager.getMessageHandler();

  // Main stream loop
  while (worker.isActive) {
    try {
      if (retryCount === 0) backoffTime = RETRY_DELAY_MS;

      const stream = await client.conversations.streamAllMessages();
      for await (const message of stream) {
        if (!worker.isActive) break;

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

        if (!conversation) continue;

        const isDm = conversation instanceof Dm;
        if (options.welcomeMessage && isDm) {
          const sent = await sendWelcomeMessage(
            client,
            conversation,
            options.welcomeMessage,
          );
          if (sent) continue;
        }

        if (isDm || options.acceptGroups) {
          try {
            await messageHandler(client, conversation, message, isDm);
          } catch (handlerError) {
            console.error(`[${env}] Error in message handler:`, handlerError);
          }
        }
      }

      // Stream ended normally
      retryCount = 0;
    } catch (error) {
      if (!worker.isActive) break;

      console.error(`[${env}] Stream error:`, error);
      retryCount++;

      // Try to re-sync conversations
      try {
        await client.conversations.sync();
      } catch (syncError) {
        console.error(`[${env}] Sync error:`, syncError);
      }

      // Use exponential backoff with jitter
      backoffTime = Math.min(backoffTime * 1.5, 60000);
      const jitter = Math.random() * 0.3 * backoffTime;
      const waitTime = backoffTime + jitter;

      console.error(
        `[${env}] Retrying in ${Math.round(waitTime / 1000)}s... (${retryCount}/${MAX_RETRIES})`,
      );
      await sleep(waitTime);
    }
  }
};

/**
 * Stop a worker by name
 */
export const stopWorker = (workerName: string, network?: string): boolean => {
  if (!workerManager) return false;

  // If network is provided, stop the specific network worker
  if (network) {
    const networkWorkerName = `${workerName}-${network}`;
    const worker = workerManager.getWorker(networkWorkerName);
    if (!worker) return false;

    worker.isActive = false;
    workerManager.terminateWorker(networkWorkerName);
    return true;
  }

  // Otherwise, try to stop all workers with this base name across all networks
  let foundAny = false;
  const allWorkers = workerManager.getAllWorkers();

  for (const worker of allWorkers) {
    if (worker.name.startsWith(`${workerName}-`)) {
      worker.isActive = false;
      workerManager.terminateWorker(worker.name);
      foundAny = true;
    }
  }

  return foundAny;
};

/**
 * Get all active workers
 * @param formatted If true, returns an object with worker info grouped by base name
 */
export const getActiveWorkers = (
  formatted = false,
): string[] | Record<string, string[]> => {
  if (!workerManager) {
    return formatted ? {} : [];
  }

  const activeWorkers = workerManager
    .getAllWorkers()
    .filter((worker) => worker.isActive);

  if (!formatted) {
    return activeWorkers.map((worker) => worker.name);
  }

  // Group workers by base name
  const groupedWorkers: Record<string, string[]> = {};

  for (const worker of activeWorkers) {
    // Split name to get base name and network
    const parts = worker.name.split("-");
    if (parts.length >= 2) {
      const baseName = parts[0];
      const network = parts[parts.length - 1];

      if (!groupedWorkers[baseName]) {
        groupedWorkers[baseName] = [];
      }

      groupedWorkers[baseName].push(network);
    } else {
      // Legacy format or unknown format
      if (!groupedWorkers["unknown"]) {
        groupedWorkers["unknown"] = [];
      }
      groupedWorkers["unknown"].push(worker.name);
    }
  }

  return groupedWorkers;
};

export const logAgentDetails = (clients: Client[]): void => {
  const clientsByAddress = clients.reduce<Record<string, Client[]>>(
    (acc, client) => {
      const address = client.accountIdentifier?.identifier ?? "";
      acc[address] = acc[address] ?? [];
      acc[address].push(client);
      return acc;
    },
    {},
  );

  for (const [address, clientGroup] of Object.entries(clientsByAddress)) {
    const firstClient = clientGroup[0];
    const inboxId = firstClient.inboxId;
    const environments = clientGroup
      .map((c) => c.options?.env ?? "dev")
      .join(", ");
    console.log(`\x1b[38;2;252;76;52m
        ██╗  ██╗███╗   ███╗████████╗██████╗ 
        ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
         ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
         ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝ 
        ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║     
        ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝     
      \x1b[0m`);

    const urls = [`http://xmtp.chat/dm/${address}`];

    console.log(`
    ✓ XMTP Client:
    • Address: ${address}
    • InboxId: ${inboxId}
    • Networks: ${environments}
    ${urls.map((url) => `• URL: ${url}`).join("\n")}`);
  }
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
    await conversation.send(welcomeMessage);
    return true;
  }
  return false;
};
