import type { Client } from "@xmtp/node-sdk";

export async function createGroup(
  client: Client,
  senderAddress: string,
  clientAddress: string,
) {
  try {
    let senderInboxId = "";
    await client.conversations.sync();
    const conversations = client.conversations.list();
    console.log("Conversations", conversations.length);
    const group = await client.conversations.newGroup([
      senderAddress,
      clientAddress,
    ]);
    console.log("Group created", group.id);
    const members = await group.members();
    const senderMember = members.find((member) =>
      member.accountAddresses.includes(senderAddress.toLowerCase()),
    );

    if (senderMember) {
      senderInboxId = senderMember.inboxId;
      console.log("Sender's inboxId:", senderInboxId);
    } else {
      console.log("Sender not found in members list");
    }
    await group.addSuperAdmin(senderInboxId);
    console.log("Sender is superAdmin", group.isSuperAdmin(senderInboxId));
    await group.send(`Welcome to the new group!`);
    await group.send(`You are now the admin of this group as well as the bot`);
    return group;
  } catch (error) {
    console.log("Error creating group", error);
    return null;
  }
}

export async function removeFromGroup(
  groupId: string,
  client: Client,
  senderAddress: string,
): Promise<void> {
  try {
    const lowerAddress = senderAddress.toLowerCase();
    const isOnXMTP = await client.canMessage([lowerAddress]);
    console.warn("Checking if on XMTP: ", isOnXMTP);
    if (!isOnXMTP.get(lowerAddress)) {
      console.error("You don't seem to have a v3 identity ");
      return;
    }
    const conversation = client.conversations.getConversationById(groupId);
    console.warn("removing from group", conversation?.id);
    await conversation?.sync();
    await conversation?.removeMembers([lowerAddress]);
    console.warn("Removed member from group");
    await conversation?.sync();
    const members = await conversation?.members();
    console.warn("Number of members", members?.length);

    let wasRemoved = true;
    if (members) {
      for (const member of members) {
        const lowerMemberAddress = member.accountAddresses[0].toLowerCase();
        if (lowerMemberAddress === lowerAddress) {
          wasRemoved = false;
          break;
        }
      }
    }
    console.log(
      "You have been removed from the group",
      wasRemoved ? "success" : "failed",
    );
    return;
  } catch (error) {
    console.log("Error removing from group", error);
    return;
  }
}

export async function addToGroup(
  groupId: string,
  client: Client,
  address: string,
  asAdmin: boolean = false,
): Promise<void> {
  try {
    const lowerAddress = address.toLowerCase();
    const isOnXMTP = await client.canMessage([lowerAddress]);
    if (!isOnXMTP.get(lowerAddress)) {
      console.error("You don't seem to have a v3 identity ");
      return;
    }
    const group = client.conversations.getConversationById(groupId);
    console.warn("Adding to group", group?.id);
    await group?.sync();
    await group?.addMembers([lowerAddress]);
    console.warn("Added member to group");
    await group?.sync();
    if (asAdmin) {
      await group?.addSuperAdmin(lowerAddress);
    }
    const members = await group?.members();
    console.warn("Number of members", members?.length);

    if (members) {
      for (const member of members) {
        const lowerMemberAddress = member.accountAddresses[0].toLowerCase();
        if (lowerMemberAddress === lowerAddress) {
          console.warn("Member exists", lowerMemberAddress);
          return;
        }
      }
    }
    return;
  } catch (error) {
    console.error("Error adding to group", error);
  }
}
