import { Client, Group } from "@xmtp/node-sdk";
import { env } from "@/lib/env";
import {
  createNodeEphemeralSigner,
  generateEncryptionKeyHex,
  getEncryptionKeyFromHex,
} from "@/lib/utils";

// create ephemeral node signer
const signer = createNodeEphemeralSigner(env.XMTP_PRIVATE_KEY);

// create random encryption key
const encryptionKey = env.XMTP_ENCRYPTION_KEY
  ? env.XMTP_ENCRYPTION_KEY
  : generateEncryptionKeyHex();

/**
 * Add a user to the default group chat
 * @param newUserInboxId - The inbox ID of the user to add
 * @returns true if the user was added, false otherwise
 */
export const addUserToDefaultGroupChat = async (
  newUserInboxId: string,
): Promise<boolean> => {
  console.log("Adding user to default group chat", newUserInboxId);
  // create XMTP Node client
  console.log("Creating XMTP Node client with encription key", encryptionKey);
  const client = await Client.create(
    signer,
    getEncryptionKeyFromHex(encryptionKey),
    {
      env: env.XMTP_ENV,
    },
  );
  // Sync the conversations from the network to update the local db
  await client.conversations.sync();
  // await client.conversations.syncAll();

  // Get the group chat by id
  const conversation = await client.conversations.getConversationById(
    env.NEXT_PUBLIC_XMTP_DEFAULT_CONVERSATION_ID,
  );
  if (!conversation)
    throw new Error(
      `Conversation not found with id: ${env.NEXT_PUBLIC_XMTP_DEFAULT_CONVERSATION_ID} on env: ${env.XMTP_ENV}`,
    );

  // Get the metadata
  const metadata = await conversation.metadata();
  console.log("Conversation found", metadata);
  if (metadata?.conversationType !== "group")
    throw new Error("Conversation is not a group");

  // load members from the group
  const group = conversation as Group;
  const groupMembers = await group.members();
  console.log(
    "Group members",
    groupMembers.map((member) => member.inboxId),
  );
  const isMember = groupMembers.some(
    (member) => member.inboxId === newUserInboxId,
  );
  if (isMember) {
    console.warn("User already in group, skipping...");
  } else {
    // Add the user to the group chat
    await group.addMembers([newUserInboxId]);
  }
  return true;
};
