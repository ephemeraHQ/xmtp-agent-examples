"use client";

import sdk from "@farcaster/frame-sdk";
import { useQuery } from "@tanstack/react-query";
import {
  Conversation,
  DecodedMessage,
  Dm,
  Group,
  SafeGroupMember,
} from "@xmtp/browser-sdk";
import ky from "ky";
import { ArrowLeftIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useXMTP } from "@/context/xmtp-context";
import { useConversation } from "@/hooks/use-conversation";
import { useConversations } from "@/hooks/use-conversations";
import { DEFAULT_CONVERSATION_ID } from "@/lib/constants";
import { createDMCastIntent } from "@/lib/utils/warpcast";
import { useFrame } from "@/providers/frame-provider";
import { FarcasterUserBulkResponse } from "@/types";

export default function HomeContent() {
  const { context } = useFrame();
  const { client, conversations, setConversations } = useXMTP();
  const [joining, setJoining] = useState(false);
  const { getConversationById, loading, list } = useConversations();
  const [currentConversation, setCurrentConversation] = useState<
    Conversation | undefined
  >(undefined);
  const { getMessages, send } = useConversation(currentConversation);
  const [currentConversationMessages, setCurrentConversationMessages] =
    useState<DecodedMessage[]>([]);
  const [group, setGroup] = useState<Group | undefined>(undefined);
  const [groupMembers, setGroupMembers] = useState<SafeGroupMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [handleSearch, setHandleSearch] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentConversationName, setCurrentConversationName] = useState("");

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () =>
      ky
        .get<FarcasterUserBulkResponse>(
          `/api/farcaster/search?q=${searchQuery}&viewer_fid=${context?.user?.fid ?? 2}&limit=10`,
        )
        .json(),
    enabled: handleSearch,
  });

  useEffect(() => {
    if (searchResults) {
      setHandleSearch(false);
    }
  }, [searchResults]);

  useEffect(() => {
    const loadConversations = async () => {
      const newConversations = await list(undefined, true);
      setConversations(newConversations);
      const conversation = await getConversationById(DEFAULT_CONVERSATION_ID);
      if (conversation && conversation instanceof Group) {
        setGroup(conversation);
        const members = await conversation.members();
        setGroupMembers(members);
      }
    };
    void loadConversations();
  }, []);

  const loadMessages = async () => {
    const messages = await getMessages(undefined, true);
    if (messages) {
      setCurrentConversationMessages(messages);
    }
  };

  useEffect(() => {
    if (!currentConversation) return;
    void loadMessages();
  }, [currentConversation]);

  const handleSetConversation = async (conv: Conversation) => {
    setCurrentConversation(conv);
    setCurrentConversationName(
      conv.metadata?.conversationType === "dm"
        ? "DM"
        : ((conv as Group).name ?? ""),
    );
  };

  const handleAddMeToDefaultConversation = async () => {
    if (!client) return;

    // Add me to the default conversation
    try {
      setJoining(true);
      const data = await ky
        .post<{ success: boolean; message: string }>("/api/join-chat", {
          json: {
            inboxId: client.inboxId,
          },
        })
        .json();
      setJoining(false);

      if (data.success) {
        const newConversations = await list(undefined, true);
        setConversations(newConversations);
      } else {
        console.warn("Failed to add me to the default conversation", data);
      }
    } catch (error) {
      console.error("Error adding me to the default conversation", error);
      setJoining(false);
    }
  };

  const handleBackToConversations = () => {
    setCurrentConversation(undefined);
    setCurrentConversationMessages([]);
    setMessage("");
    setSearchQuery("");
    setHandleSearch(false);
  };

  const handleInviteUser = async (userFid: number) => {
    const url = createDMCastIntent(userFid);
    if (!!context) {
      sdk.actions.openUrl(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleSend = async () => {
    await send(message);
    setMessage("");
    void loadMessages();
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="min-h-screen flex flex-col gap-2 px-4 py-2">
      {!currentConversation ? (
        <div className="flex flex-col gap-2 text-center mt-4">
          <button
            onClick={handleAddMeToDefaultConversation}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200"
            disabled={loading || joining}>
            {loading || joining ? "Joining..." : "Join Chat"}
          </button>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold text-white">My Conversations</h2>
            {conversations.map(async (conv) => {
              let convName = "";
              // DM: fetch peer inbox id and truncate to 6 characters
              if (conv.metadata?.conversationType === "dm") {
                const peerInboxId = await (conv as Dm).peerInboxId();
                convName = `DM ${peerInboxId.slice(0, 6)}...${peerInboxId.slice(
                  -4,
                )}`;
              } else {
                // Group: use name from metadata
                convName = (conv as Group).name ?? "";
              }
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSetConversation(conv)}
                  className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200">
                  {convName}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row items-center justify-start gap-2">
            <button
              onClick={handleBackToConversations}
              className="px-2 py-2 bg-gray-800 rounded-lg">
              <ArrowLeftIcon className="w-4 h-4 text-white" />
            </button>
            <h2 className="text-2xl font-bold text-white">
              {currentConversationName}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            <h2>Invite other users on this XMTP chat</h2>
            <div className="flex flex-col gap-2">
              <div className="flex flex-row items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a farcaster username..."
                  className="w-full px-2 py-1 rounded-xl border border-gray-300 bg-gray-800 text-white"
                />
                <button onClick={() => setHandleSearch(!handleSearch)}>
                  {isSearchLoading ? "Searching..." : "Search"}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {searchResults?.data.users.map((user) => (
                  <div
                    key={user.fid}
                    className="flex flex-col items-center justify-center gap-2 px-2 py-1 bg-gray-800 rounded-lg"
                    onClick={() => handleInviteUser(user.fid)}>
                    <Image
                      src={user.pfp_url}
                      alt={user.username}
                      width={32}
                      height={32}
                      className="rounded-full w-[32px] h-[32px] object-cover"
                    />
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-sm text-gray-400">Invite</p>
                      <span className="text-xl font-bold text-gray-400">
                        {user.username}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 w-full min-h-[400px]">
              {currentConversationMessages.map((message) => {
                const isSender = client?.inboxId === message.senderInboxId;
                const member = groupMembers.find(
                  (member) => member.inboxId === message.senderInboxId,
                );
                const senderDisplayName = member
                  ? member.accountIdentifiers[0].identifier
                  : message.senderInboxId;
                return (
                  <div
                    key={message.id}
                    className={`flex flex-row text-sm w-full ${isSender ? "text-blue-500 justify-end" : "text-gray-400 justify-start"}`}>
                    <div
                      className={`flex flex-col items-start ${isSender ? "items-end" : "items-start"}`}>
                      <p>{`${senderDisplayName.slice(0, 6)}...${senderDisplayName.slice(-4)}`}</p>
                      <p>{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-row items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message..."
                className="w-full px-2 py-1 rounded-xl border border-gray-300 bg-gray-800 text-white"
              />
              <button onClick={handleSend}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
