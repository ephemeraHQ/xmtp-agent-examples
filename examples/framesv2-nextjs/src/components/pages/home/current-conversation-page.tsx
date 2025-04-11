import sdk from "@farcaster/frame-sdk";
import { useQuery } from "@tanstack/react-query";
import {
  Conversation,
  DecodedMessage,
  Group,
  SafeGroupMember,
} from "@xmtp/browser-sdk";
import ky from "ky";
import { ArrowLeftIcon, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { useFrame } from "@/context/frame-context";
import { useXMTP } from "@/context/xmtp-context";
import { useConversation } from "@/hooks/use-conversation";
import { createDMCastIntent } from "@/lib/utils/warpcast";
import { FarcasterUserBulkResponse } from "@/types";
import MessageList from "./message-list";
import { SendMessage } from "./send-message";
import UserSearch from "./user-search";

interface CurrentConversationPageProps {
  conversation: Conversation;
  onBack: () => void;
}

export default function CurrentConversationPage({
  conversation,
  onBack,
}: CurrentConversationPageProps) {
  const { context } = useFrame();
  const { client } = useXMTP();
  const viewportRef = useRef<HTMLDivElement>(null);
  const { getMessages } = useConversation(conversation);

  const [currentConversationMessages, setCurrentConversationMessages] =
    useState<DecodedMessage[]>([]);
  const [groupMembers, setGroupMembers] = useState<SafeGroupMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [handleSearch, setHandleSearch] = useState(false);
  const [showInviteUsers, setShowInviteUsers] = useState(false);
  const [clientAddress, setClientAddress] = useState<`0x${string}` | undefined>(
    undefined,
  );

  useEffect(() => {
    const loadClientAddress = async () => {
      if (!client || !client.inboxId) return;

      const inboxState = await client.preferences.inboxStateFromInboxIds([
        client.inboxId,
      ]);
      for (const member of inboxState[0].accountIdentifiers) {
        const memberAddress = member.identifier;
        if (!memberAddress) {
          console.log("Unable to find member address, skipping");
          continue;
        }
        if (member.identifierKind === "Ethereum") {
          if (memberAddress.startsWith("0x")) {
            setClientAddress(memberAddress as `0x${string}`);
            break;
          }
        }
      }
    };
    void loadClientAddress();
  }, [client, conversation]);

  const conversationName =
    conversation.metadata?.conversationType === "dm"
      ? "DM"
      : ((conversation as Group).name ?? "");

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () =>
      ky
        .get<FarcasterUserBulkResponse>(
          `/api/farcaster/search?q=${searchQuery}&viewer_fid=${context?.user?.fid ?? 2}&limit=10`,
        )
        .json(),
    enabled: handleSearch && searchQuery.length > 0,
  });

  useEffect(() => {
    const loadMembers = async () => {
      if (conversation instanceof Group) {
        const members = await conversation.members();
        setGroupMembers(members);
      }
    };
    void loadMembers();
  }, [conversation]);

  const scrollToBottom = () => {
    if (viewportRef.current) {
      setTimeout(() => {
        const scrollArea = viewportRef.current!;
        scrollArea.scroll({
          behavior: "smooth",
          top: scrollArea.scrollHeight,
        });
      }, 1000);
    }
  };

  const loadMessages = async () => {
    const messages = await getMessages(undefined, true);
    if (messages) {
      setCurrentConversationMessages(messages);
      scrollToBottom();
    }
  };

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation]);

  const handleInviteUser = async (userFid: number) => {
    const url = createDMCastIntent(userFid);
    if (!!context) {
      sdk.actions.openUrl(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleBack = () => {
    setCurrentConversationMessages([]);
    setGroupMembers([]);
    setSearchQuery("");
    setHandleSearch(false);
    setShowInviteUsers(false);
    onBack();
  };

  const handleRefresh = async () => {
    await loadMessages();
  };

  return (
    <div className="relative h-full flex flex-col justify-between gap-1">
      {/* Page Header */}
      <div className="relative flex flex-row items-center justify-between gap-0">
        <div className="flex flex-row items-center justify-start gap-2">
          <button
            onClick={handleBack}
            className="px-2 py-2 bg-gray-800 rounded-lg">
            <ArrowLeftIcon className="w-4 h-4 text-white" />
          </button>
          <h2 className="text-lg font-bold text-white">{conversationName}</h2>
        </div>
        <div className="flex flex-row items-center justify-end gap-2">
          <Button
            variant="outline"
            className="text-xs text-gray-400"
            onClick={() => setShowInviteUsers((prev) => !prev)}>
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="text-xs text-gray-400"
            onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {/* User Search */}
        {showInviteUsers && (
          <UserSearch
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleSearch={handleSearch}
            setHandleSearch={setHandleSearch}
            setShowInviteUsers={setShowInviteUsers}
            searchResults={searchResults}
            isSearchLoading={isSearchLoading}
            onInviteUser={handleInviteUser}
          />
        )}
      </div>

      {/* Message List */}
      <ScrollArea className="max-h-[72vh]" viewportRef={viewportRef}>
        <MessageList
          messages={currentConversationMessages}
          groupMembers={groupMembers}
          clientInboxId={client?.inboxId}
          conversation={conversation}
          refreshMessages={loadMessages}
        />
      </ScrollArea>

      {/* Send Message */}
      <SendMessage
        conversation={conversation}
        loadMessages={loadMessages}
        memberAddress={clientAddress}
      />
    </div>
  );
}
