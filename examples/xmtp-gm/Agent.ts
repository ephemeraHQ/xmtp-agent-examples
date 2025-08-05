import EventEmitter from "node:events";
import { Client, Conversation, DecodedMessage, Group } from "@xmtp/node-sdk";

export type AgentEventHandler = (ctx: AgentContext) => Promise<void> | void;

export type AgentMiddleware = (
  ctx: AgentContext,
  next: () => Promise<void>,
) => Promise<void>;

export type AgentMessageFilter = (
  message: DecodedMessage,
  client: Client,
) => boolean | Promise<boolean>;

export interface AgentOptions {
  /** XMTP client instance */
  client: Client;
  /** Whether to sync conversations on start */
  autoSync?: boolean;
}

type Identifier = string;

export interface AgentContext {
  client: Client;
  conversation: Conversation;
  message: DecodedMessage;
  send: (text: string) => Promise<void>;
  getSenderAddress: () => Promise<Identifier>;
}

export class Agent extends EventEmitter {
  private client: Client;
  private middleware: AgentMiddleware[] = [];
  private messageHandlers: Map<
    string,
    { filter?: unknown; handler: AgentEventHandler }[]
  > = new Map();
  private isListening = false;

  constructor(options: AgentOptions) {
    super();
    this.client = options.client;
    process.once("SIGINT", this.stop);
    process.once("SIGTERM", this.stop);
  }

  use(middleware: AgentMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  on(event: "message", handler: AgentEventHandler): this;
  on(event: string, handler: AgentEventHandler): this {
    if (event === "message") {
      const actualHandler = handler;

      if (!this.messageHandlers.has("message")) {
        this.messageHandlers.set("message", []);
      }

      this.messageHandlers.get("message")?.push({ handler: actualHandler });
    } else {
      super.on(event, handler);
    }
    return this;
  }

  async start(): Promise<void> {
    if (this.isListening) {
      console.warn("Agent is already listening");
      return;
    }

    try {
      console.log("✓ Syncing conversations...");
      await this.client.conversations.sync();

      console.log("🤖 Agent starting to listen for messages...");
      this.isListening = true;
      this.emit("start");

      const stream = await this.client.conversations.streamAllMessages();
      for await (const message of stream) {
        if (!this.isListening) break;

        try {
          await this.processMessage(message);
        } catch (error: unknown) {
          this.handleError(error);
        }
      }
    } catch (error: unknown) {
      this.handleError(error);
    }
  }

  private async processMessage(message: DecodedMessage): Promise<void> {
    // Skip if the message is from the agent itself (prevents infinite loop)
    if (
      message.senderInboxId.toLowerCase() === this.client.inboxId.toLowerCase()
    ) {
      return;
    }

    // Skip if it's not a text message
    if (message.contentType?.typeId !== "text") {
      return;
    }

    const conversation = await this.client.conversations.getConversationById(
      message.conversationId,
    );
    if (!conversation) {
      console.log(
        `Unable to find conversation ID "${message.conversationId}", skipping message...`,
      );
      return;
    }

    const ctx = await this.createContext(message, conversation);

    let index = 0;
    const next = async () => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        await middleware(ctx, next);
      } else {
        await this.executeHandlers(ctx);
      }
    };

    await next();
  }

  private async executeHandlers(ctx: AgentContext) {
    const messageHandlers = this.messageHandlers.get("message") || [];
    for (const { handler } of messageHandlers) {
      await handler(ctx);
    }
  }

  private async createContext(
    message: DecodedMessage,
    conversation: NonNullable<
      Awaited<ReturnType<typeof this.client.conversations.getConversationById>>
    >,
  ): Promise<AgentContext> {
    const ctx: AgentContext = {
      message,
      conversation,
      client: this.client,
      send: async (text: string) => {
        await conversation.send(text);
      },
      getSenderAddress: async () => {
        const inboxState = await this.client.preferences.inboxStateFromInboxIds(
          [message.senderInboxId],
        );
        return inboxState[0].identifiers[0].identifier;
      },
    };
    return ctx;
  }

  stop() {
    console.log("🛑 Stopping agent...");
    this.isListening = false;
    this.emit("stop");
  }

  private handleError(error: unknown) {
    console.error("Agent error", error);
    this.emit("error", error);
  }
}
