import { Client, Group } from "@xmtp/node-sdk";
import { hexToUint8Array, uint8ArrayToHex } from "uint8array-extras";
import { env } from "@/lib/env";
import { createNodeEphemeralSigner } from "@/lib/utils";

// create ephemeral node signer
const signer = createNodeEphemeralSigner(env.XMTP_PRIVATE_KEY as `0x${string}`);

// create random encryption key
const encryptionKey = env.XMTP_ENCRYPTION_KEY
  ? env.XMTP_ENCRYPTION_KEY
  : uint8ArrayToHex(crypto.getRandomValues(new Uint8Array(32)));

/**
 * Add a user to the default group chat
 * @param newUserInboxId - The inbox ID of the user to add
 * @returns true if the user was added, false otherwise
 */
export const addUserToDefaultGroupChat = async (
  newUserInboxId: string,
): Promise<boolean> => {
  // create XMTP Node client
  console.log("Creating XMTP Node client with encription key", encryptionKey);
  const client = await Client.create(signer, hexToUint8Array(encryptionKey), {
    env: env.XMTP_ENV,
  });
  // Sync the conversations from the network to update the local db
  await client.conversations.sync();

  try {
    // Get the group chat by id
    const conversation = await client.conversations.getConversationById(
      env.NEXT_PUBLIC_XMTP_DEFAULT_CONVERSATION_ID,
    );
    if (!conversation) throw new Error("Conversation not found");

    // Get the metadata
    const metadata = await conversation.metadata();
    console.log("Conversation found", metadata);
    if (metadata?.conversationType !== "group")
      throw new Error("Conversation is not a group");

    // load members from the group
    const group = conversation as Group;
    const groupMembers = await group.members();
    console.log("Group members", groupMembers);
    if (groupMembers.some((member) => member.inboxId === newUserInboxId)) {
      console.warn("User already in group, skipping...");
      return true;
    }

    // Add the user to the group chat
    await group.addMembers([newUserInboxId]);
    return true;
  } catch (error) {
    console.error("Error adding user to group", error);
    return false;
  }
};
