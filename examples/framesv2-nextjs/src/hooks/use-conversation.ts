import type {
  Conversation,
  DecodedMessage,
  SafeListMessagesOptions,
} from "@xmtp/browser-sdk";
import { ContentTypeReaction } from "@xmtp/content-type-reaction";
import { ContentTypeRemoteAttachment } from "@xmtp/content-type-remote-attachment";
import { ContentTypeReply } from "@xmtp/content-type-reply";
import { ContentTypeTransactionReference } from "@xmtp/content-type-transaction-reference";
import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { useState } from "react";
import { useXMTP } from "@/context/xmtp-context";

type ContentType =
  | typeof ContentTypeReaction
  | typeof ContentTypeRemoteAttachment
  | typeof ContentTypeReply
  | typeof ContentTypeTransactionReference
  | typeof ContentTypeWalletSendCalls;

export const useConversation = (conversation?: Conversation) => {
  const { client } = useXMTP();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<DecodedMessage[]>([]);

  const getMessages = async (
    options?: SafeListMessagesOptions,
    syncFromNetwork: boolean = false,
  ) => {
    if (!client) {
      return;
    }

    if (syncFromNetwork) {
      await sync();
    }

    setLoading(true);

    try {
      const msgs = (await conversation?.messages(options)) ?? [];
      setMessages(msgs);
      return msgs;
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    if (!client) {
      return;
    }

    setSyncing(true);

    try {
      await conversation?.sync();
    } finally {
      setSyncing(false);
    }
  };

  const send = async (content: any, contentType?: ContentType) => {
    if (!client) return;

    setSending(true);

    try {
      await conversation?.send(content, contentType);
    } finally {
      setSending(false);
    }
  };

  const streamMessages = async () => {
    const noop = () => {};
    if (!client) {
      return noop;
    }

    const onMessage = (
      error: Error | null,
      message: DecodedMessage | undefined,
    ) => {
      if (message) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const stream = await conversation?.stream(onMessage);

    return stream
      ? () => {
          void stream.return(undefined);
        }
      : noop;
  };

  return {
    getMessages,
    loading,
    messages,
    send,
    sending,
    streamMessages,
    sync,
    syncing,
  };
};
