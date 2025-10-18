import {
  Agent,
  IdentifierKind,
  type Conversation,
  type DecodedMessage,
  type XmtpEnv,
  type Group,
  type Dm,
} from "@xmtp/agent-sdk";
import { createSigner, createUser } from "@xmtp/agent-sdk/user";
import { fromString } from "uint8arrays/from-string";
import type { ConversationInfo, FormattedMessage } from "./types.js";

export class XmtpClient {
  private agent: Agent | null = null;
  private signer: any = null;

  constructor(public env: XmtpEnv = "production") {}

  async initialize(): Promise<Agent> {
    if (this.agent) {
      return this.agent;
    }

    const walletKey = process.env.XMTP_CLIENT_WALLET_KEY;
    const encryptionKey = process.env.XMTP_CLIENT_DB_ENCRYPTION_KEY;

    if (!walletKey || !encryptionKey) {
      throw new Error(
        "XMTP_CLIENT_WALLET_KEY and XMTP_CLIENT_DB_ENCRYPTION_KEY must be set in environment",
      );
    }

    const user = createUser(walletKey as `0x${string}`);
    this.signer = createSigner(user);
    const dbEncryptionKey = fromString(encryptionKey, "hex");

    this.agent = await Agent.create(this.signer, {
      env: this.env,
      dbEncryptionKey,
    });

    return this.agent;
  }

  async getClientInfo(): Promise<{
    address: string;
    inboxId: string;
    conversationCount: number;
    installationCount: number;
  }> {
    const agent = await this.initialize();
    const client = agent.client;

    const address = await agent.address;

    await client.conversations.sync();
    const conversations = await client.conversations.list();
    const inboxState = await client.preferences.inboxState();

    return {
      address: address as string,
      inboxId: client.inboxId,
      conversationCount: conversations.length,
      installationCount: inboxState.installations.length,
    };
  }

  async getConversations(): Promise<Conversation[]> {
    const agent = await this.initialize();
    await agent.client.conversations.sync();
    return await agent.client.conversations.list();
  }

  async getConversationInfo(
    conversation: Conversation,
  ): Promise<ConversationInfo> {
    const isGroup = conversation.constructor.name === "Group";

    if (isGroup) {
      const group = conversation as Group;
      const members = await conversation.members();
      return {
        id: conversation.id,
        type: "group",
        name: group.name || "Unnamed Group",
        memberCount: members.length,
      };
    } else {
      const dm = conversation as Dm;
      return {
        id: conversation.id,
        type: "dm",
        peerInboxId: dm.peerInboxId,
      };
    }
  }

  async findOrCreateDm(identifier: string): Promise<Conversation> {
    const agent = await this.initialize();
    const client = agent.client;

    await client.conversations.sync();
    const conversations = await client.conversations.list();

    const isEthAddress =
      identifier.startsWith("0x") && identifier.length === 42;

    // Try to find existing conversation
    for (const conv of conversations) {
      if (conv.constructor.name === "Dm") {
        const dm = conv as Dm;

        if (dm.peerInboxId.toLowerCase() === identifier.toLowerCase()) {
          return conv;
        }

        if (isEthAddress) {
          const members = await conv.members();
          for (const member of members) {
            const ethIdentifier = member.accountIdentifiers.find(
              (id) => id.identifierKind === IdentifierKind.Ethereum,
            );
            if (
              ethIdentifier &&
              ethIdentifier.identifier.toLowerCase() ===
                identifier.toLowerCase()
            ) {
              return conv;
            }
          }
        }
      }
    }

    // Create new conversation
    if (isEthAddress) {
      return await client.conversations.newDmWithIdentifier({
        identifier,
        identifierKind: IdentifierKind.Ethereum,
      });
    } else {
      return await client.conversations.newDm(identifier);
    }
  }

  async createGroup(identifiers: string[]): Promise<Conversation> {
    const agent = await this.initialize();
    const client = agent.client;

    const allEthAddresses = identifiers.every(
      (id) => id.startsWith("0x") && id.length === 42,
    );

    if (allEthAddresses) {
      const memberIdentifiers = identifiers.map((id) => ({
        identifier: id,
        identifierKind: IdentifierKind.Ethereum,
      }));

      return await client.conversations.newGroupWithIdentifiers(
        memberIdentifiers,
        {
          groupName: "CLI Group Chat",
          groupDescription: "Group created from CLI",
        },
      );
    } else {
      return await client.conversations.newGroup(identifiers, {
        groupName: "CLI Group Chat",
        groupDescription: "Group created from CLI",
      });
    }
  }

  async getMessages(conversation: Conversation): Promise<DecodedMessage[]> {
    await conversation.sync();
    return await conversation.messages();
  }

  async sendMessage(conversation: Conversation, text: string): Promise<void> {
    await conversation.send(text);
  }

  async streamMessages(
    callback: (message: DecodedMessage) => void,
  ): Promise<void> {
    const agent = await this.initialize();
    const messageStream = await agent.client.conversations.streamAllMessages();

    for await (const message of messageStream) {
      callback(message);
    }
  }

  formatMessage(
    message: DecodedMessage,
    currentInboxId: string,
  ): FormattedMessage {
    const isFromSelf = message.senderInboxId === currentInboxId;
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

    return {
      id: message.id,
      senderInboxId: message.senderInboxId,
      content,
      timestamp: message.sentAt,
      isFromSelf,
    };
  }

  getAgent(): Agent | null {
    return this.agent;
  }

  get inboxId(): string {
    if (!this.agent) {
      throw new Error("Agent not initialized");
    }
    return this.agent.client.inboxId;
  }
}
