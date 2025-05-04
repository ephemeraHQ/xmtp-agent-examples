import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { Client, type DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";

// Worker configuration interfaces
export interface WorkerConfig {
  name: string;
  walletKey: string;
  encryptionKey: string;
  xmtpEnv: XmtpEnv;
}

export interface WorkerInstance {
  name: string;
  address: string;
  inboxId: string;
  client: Client;
  messageStream?: AsyncIterable<DecodedMessage>;
  isTerminated: boolean;
}

/**
 * Manager for parallel XMTP client workers
 */
export class XmtpWorkerManager {
  private workers: Record<string, WorkerInstance> = {};
  private activeWorkers: WorkerInstance[] = [];
  private xmtpEnv: XmtpEnv;

  constructor(xmtpEnv: XmtpEnv) {
    this.xmtpEnv = xmtpEnv;
  }

  /**
   * Get a worker by name
   */
  get(name: string): WorkerInstance | undefined {
    return this.workers[name];
  }

  /**
   * Create multiple workers at once
   */
  async createWorkers(configs: WorkerConfig[]): Promise<WorkerInstance[]> {
    const promises = configs.map((config) => this.createWorker(config));
    return Promise.all(promises);
  }

  /**
   * Create a single worker with an XMTP client
   */
  async createWorker(config: WorkerConfig): Promise<WorkerInstance> {
    console.log(`Creating worker: ${config.name}`);

    // Create signer and encryption key
    const signer = createSigner(config.walletKey);
    const dbEncryptionKey = getEncryptionKeyFromHex(config.encryptionKey);

    // Create XMTP client
    const client = await Client.create(signer, {
      dbEncryptionKey,
      env: config.xmtpEnv,
    });

    // Get address information
    const identifier = await signer.getIdentifier();
    const address = identifier.identifier;

    console.log(`✓ Worker ${config.name} created:`);
    console.log(`  Address: ${address}`);
    console.log(`  Inbox ID: ${client.inboxId}`);
    console.log(`  Environment: ${config.xmtpEnv}`);

    // Create worker instance
    const worker: WorkerInstance = {
      name: config.name,
      address,
      inboxId: client.inboxId,
      client,
      isTerminated: false,
    };

    // Store the worker
    this.workers[config.name] = worker;
    this.activeWorkers.push(worker);

    return worker;
  }

  /**
   * Start message streaming for a worker
   */
  async startMessageStream(
    name: string,
    messageHandler: (
      worker: WorkerInstance,
      message: DecodedMessage,
    ) => Promise<void>,
  ): Promise<void> {
    const worker = this.get(name);
    if (!worker) {
      throw new Error(`Worker ${name} not found`);
    }

    console.log(`✓ Syncing conversations for ${name}...`);
    await worker.client.conversations.sync();

    console.log(`✓ Starting message stream for ${name}...`);
    const stream = await worker.client.conversations.streamAllMessages();
    worker.messageStream = stream as unknown as AsyncIterable<DecodedMessage>;

    // Process messages in the background
    this.processMessages(worker, messageHandler).catch((error: unknown) => {
      console.error(`Error in message stream for ${name}:`, error);
    });

    return Promise.resolve();
  }

  /**
   * Process messages from a worker's stream
   */
  private async processMessages(
    worker: WorkerInstance,
    messageHandler: (
      worker: WorkerInstance,
      message: DecodedMessage,
    ) => Promise<void>,
  ): Promise<void> {
    if (!worker.messageStream) {
      console.error(`No message stream available for ${worker.name}`);
      return;
    }

    try {
      for await (const message of worker.messageStream) {
        if (worker.isTerminated) break;

        // Skip messages from self or non-text messages
        if (
          message.senderInboxId.toLowerCase() ===
            worker.client.inboxId.toLowerCase() ||
          message.contentType?.typeId !== "text"
        ) {
          continue;
        }

        // Handle the message
        await messageHandler(worker, message);
      }
    } catch (error) {
      if (!worker.isTerminated) {
        console.error(`Stream error for ${worker.name}:`, error);
      }
    }
  }

  /**
   * Terminate all workers
   */
  async terminateAll(): Promise<void> {
    console.log("Terminating all workers...");

    for (const worker of this.activeWorkers) {
      worker.isTerminated = true;
      // Close streams if possible
      if (worker.messageStream && "return" in worker.messageStream) {
        try {
          const stream =
            worker.messageStream as AsyncIterable<DecodedMessage> & {
              return?: () => Promise<unknown>;
            };
          if (stream.return) {
            await stream.return();
          }
        } catch (error) {
          console.error(`Error closing stream for ${worker.name}:`, error);
        }
      }
    }

    this.activeWorkers = [];
    this.workers = {};
    console.log("All workers terminated");
  }
}

/**
 * Helper function to create a WorkerManager with initialized workers
 */
export async function createXmtpWorkers(
  configs: WorkerConfig[],
): Promise<XmtpWorkerManager> {
  const manager = new XmtpWorkerManager(configs[0]?.xmtpEnv);
  await manager.createWorkers(configs);
  return manager;
}
