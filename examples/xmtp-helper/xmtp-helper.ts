import {
  createSigner,
  getEncryptionKeyFromHex,
  logAgentDetails,
} from "@helpers/client";
import { Client, type DecodedMessage, type XmtpEnv } from "@xmtp/node-sdk";

// Constants for retry mechanism
const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000; // 5 seconds

export interface XmtpConfig {
  walletKey: string;
  encryptionKey: string;
  env: string;
}

export interface ProcessedMessage {
  content: string;
  senderInboxId: string;
  senderAddress: string;
  conversationId: string;
}

export type MessageHandler = (
  message: ProcessedMessage,
) => Promise<string | undefined> | string | undefined;

export class XmtpHelper {
  private client?: Client;
  private config: XmtpConfig;
  private retries: number = MAX_RETRIES;

  constructor(config: XmtpConfig) {
    this.config = config;
  }

  /**
   * Complete initialization and start the agent with a message handler
   */
  static async createAndStart(
    config: XmtpConfig,
    messageHandler: MessageHandler,
  ): Promise<XmtpHelper> {
    if (!config.walletKey || !config.encryptionKey || !config.env) {
      throw new Error("Missing required configuration");
    }

    const helper = new XmtpHelper(config);
    await helper.initialize();
    await helper.startMessageStream(messageHandler);
    return helper;
  }

  /**
   * Initialize the XMTP client
   */
  async initialize(): Promise<void> {
    const signer = createSigner(this.config.walletKey);
    const dbEncryptionKey = getEncryptionKeyFromHex(this.config.encryptionKey);

    this.client = await Client.create(signer, {
      dbEncryptionKey,
      env: this.config.env as XmtpEnv,
    });

    void logAgentDetails(this.client);
  }

  /**
   * Get the XMTP client instance
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }
    return this.client;
  }

  /**
   * Retry mechanism for stream handling
   */
  private retry(messageHandler: MessageHandler): void {
    console.log(
      `Retrying in ${RETRY_INTERVAL / 1000}s, ${this.retries} retries left`,
    );
    if (this.retries > 0) {
      this.retries--;
      setTimeout(() => {
        void this.handleStream(messageHandler);
      }, RETRY_INTERVAL);
    } else {
      console.log("Max retries reached, ending process");
      process.exit(1);
    }
  }

  /**
   * Handle stream failure
   */
  private onFail = (messageHandler: MessageHandler) => {
    console.log("Stream failed");
    this.retry(messageHandler);
  };

  /**
   * Handle the message stream with retry capability
   */
  private async handleStream(messageHandler: MessageHandler): Promise<void> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    console.log("Syncing conversations...");
    await this.client.conversations.sync();

    const stream = await this.client.conversations.streamAllMessages(
      undefined,
      undefined,
      undefined,
      () => {
        this.onFail(messageHandler);
      },
    );

    console.log("Waiting for messages...");

    for await (const message of stream) {
      if (!message) {
        continue;
      }

      try {
        const processedMessage = await this.processMessage(message);
        if (processedMessage) {
          const response = await Promise.resolve(
            messageHandler(processedMessage),
          );
          if (response) {
            console.log(
              `Sending response to ${processedMessage.senderAddress}...`,
            );
            await this.sendMessage(processedMessage.conversationId, response);
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error processing message:", errorMessage);
      }
    }
  }

  /**
   * Start listening for messages and process them with the provided handler
   */
  async startMessageStream(messageHandler: MessageHandler): Promise<void> {
    await this.handleStream(messageHandler);
  }

  /**
   * Send a message to a specific conversation
   */
  async sendMessage(conversationId: string, content: string): Promise<void> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    const conversation =
      await this.client.conversations.getConversationById(conversationId);

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    await conversation.send(content);
  }

  /**
   * Get sender address from inbox ID
   */
  async getSenderAddress(senderInboxId: string): Promise<string> {
    if (!this.client) {
      throw new Error("XMTP client not initialized. Call initialize() first.");
    }

    const inboxState = await this.client.preferences.inboxStateFromInboxIds([
      senderInboxId,
    ]);

    if (!inboxState[0]?.identifiers[0]?.identifier) {
      throw new Error(`Unable to get address for inbox ID: ${senderInboxId}`);
    }

    return inboxState[0].identifiers[0].identifier;
  }

  /**
   * Process and filter incoming messages
   */
  private async processMessage(
    message: DecodedMessage,
  ): Promise<ProcessedMessage | null> {
    if (!this.client) {
      return null;
    }

    // Skip messages from the agent itself
    if (
      message.senderInboxId.toLowerCase() === this.client.inboxId.toLowerCase()
    ) {
      return null;
    }

    // Skip non-text messages
    if (message.contentType?.typeId !== "text") {
      return null;
    }

    try {
      const senderAddress = await this.getSenderAddress(message.senderInboxId);

      return {
        content: message.content as string,
        senderInboxId: message.senderInboxId,
        senderAddress,
        conversationId: message.conversationId,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error getting sender address:", errorMessage);
      return null;
    }
  }
}
