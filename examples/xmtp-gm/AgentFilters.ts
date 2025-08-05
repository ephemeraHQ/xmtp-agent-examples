import { Client, DecodedMessage } from "@xmtp/node-sdk";

export type AgentMessageFilter = (
  message: DecodedMessage,
  client: Client,
) => boolean | Promise<boolean>;

class Filters {
  static notFromSelf(): AgentMessageFilter {
    return (message: DecodedMessage, client: Client) => {
      return (
        message.senderInboxId.toLowerCase() !== client.inboxId.toLowerCase()
      );
    };
  }

  static fromSelf(): AgentMessageFilter {
    return (message: DecodedMessage, client: Client) => {
      return (
        message.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()
      );
    };
  }

  static textOnly(): AgentMessageFilter {
    return (message: DecodedMessage) => {
      return message.contentType?.typeId === "text";
    };
  }

  static contentType(typeId: string): AgentMessageFilter {
    return (message: DecodedMessage) => {
      return message.contentType?.typeId === typeId;
    };
  }

  static fromSender(senderInboxId: string | string[]): AgentMessageFilter {
    const senders = Array.isArray(senderInboxId)
      ? senderInboxId
      : [senderInboxId];
    const normalizedSenders = senders.map((sender) => sender.toLowerCase());

    return (message: DecodedMessage) => {
      return normalizedSenders.includes(message.senderInboxId.toLowerCase());
    };
  }

  static and(...filters: AgentMessageFilter[]): AgentMessageFilter {
    return async (message: DecodedMessage, client: Client) => {
      for (const filter of filters) {
        const result = await filter(message, client);
        if (!result) return false;
      }
      return true;
    };
  }

  static or(...filters: AgentMessageFilter[]): AgentMessageFilter {
    return async (message: DecodedMessage, client: Client) => {
      for (const filter of filters) {
        const result = await filter(message, client);
        if (result) return true;
      }
      return false;
    };
  }

  static not(filter: AgentMessageFilter): AgentMessageFilter {
    return async (message: DecodedMessage, client: Client) => {
      const result = await filter(message, client);
      return !result;
    };
  }
}

export const filters = {
  // Basic filters
  notFromSelf: Filters.notFromSelf(),
  fromSelf: Filters.fromSelf(),
  textOnly: Filters.textOnly(),
  // Factory functions
  contentType: Filters.contentType,
  fromSender: Filters.fromSender,
  // Combinators
  and: Filters.and,
  or: Filters.or,
  not: Filters.not,
};
