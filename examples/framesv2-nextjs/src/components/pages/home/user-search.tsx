import { ChevronUpIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/shadcn/button";
import { FarcasterUserBulkResponse } from "@/types";

interface UserSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: boolean;
  setHandleSearch: (handle: boolean) => void;
  setShowInviteUsers: React.Dispatch<React.SetStateAction<boolean>>;
  searchResults?: FarcasterUserBulkResponse;
  isSearchLoading: boolean;
  onInviteUser: (userFid: number) => void;
}

export default function UserSearch({
  searchQuery,
  setSearchQuery,
  handleSearch,
  setHandleSearch,
  setShowInviteUsers,
  searchResults,
  isSearchLoading,
  onInviteUser,
}: UserSearchProps) {
  return (
    <>
      <div className="absolute top-10 left-0 flex flex-col gap-0 w-full z-20 bg-gray-900 rounded-lg">
        <div className="flex flex-row items-center gap-2 px-2 py-1">
          <div className="relative flex flex-row items-center gap-2 w-full ">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setHandleSearch(!handleSearch);
                  setShowInviteUsers((prev) => !prev);
                } else if (e.key === "Escape") {
                  setShowInviteUsers(false);
                }
              }}
              placeholder="Search for a farcaster user..."
              className="w-full px-2 py-1 rounded-xl border border-gray-300 bg-gray-800 text-white"
              disabled={searchQuery?.length === 0 && isSearchLoading}
            />
            <Button
              variant="ghost"
              onClick={() => {
                setSearchQuery("");
                setHandleSearch(false);
                setShowInviteUsers(false);
              }}
              className="absolute right-0">
              <XIcon className="w-4 h-4 text-white" />
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setHandleSearch(!handleSearch);
              setShowInviteUsers((prev) => !prev);
            }}
            className="text-white"
            disabled={isSearchLoading}>
            {isSearchLoading ? "Searching..." : "Search"}
          </Button>
        </div>
        <div className="h-max max-h-[200px] overflow-y-scroll">
          <div className="h-full flex flex-col gap-2  rounded-b-lg py-2 px-2">
            {searchResults ? (
              searchResults.data.users.map((user) => (
                <div
                  key={user.fid}
                  className="flex items-center justify-between gap-2 px-2 py-1 bg-gray-800 rounded-lg">
                  <div className="flex flex-row items-center gap-2">
                    <Image
                      src={user.pfp_url}
                      alt={user.username}
                      width={32}
                      height={32}
                      className="rounded-full w-[32px] h-[32px] object-cover"
                    />
                    <span className="text-lg font-semibold text-gray-400">
                      {user.username}
                    </span>
                  </div>
                  <Button
                    onClick={() => onInviteUser(user.fid)}
                    className="bg-blue-600 hover:bg-blue-600/80 text-white">
                    Invite
                  </Button>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col gap-2 bg-gray-800 rounded-b-lg py-2 px-2">
                <p className="text-white">
                  {isSearchLoading ? "Searching..." : "No users found"}
                </p>
              </div>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowInviteUsers(false)}
          className="flex flex-row items-center justify-center gap-2 w-full py- px-2 text-white bg-black rounded-b-none">
          <ChevronUpIcon className="w-4 h-4 text-white" />
          Close
        </Button>
      </div>
    </>
  );
}
