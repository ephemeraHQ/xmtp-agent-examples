import { xmtpClient, type Client, type Message } from "@xmtp/agent-starter";
import { Alchemy, Network } from "alchemy-sdk";
import express, { type Request, type Response } from "express";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API key
  network: Network.BASE_MAINNET, // Use the appropriate network
};

async function main() {
  const client = await xmtpClient({
    walletKey: process.env.WALLET_KEY as string,
    onMessage: async (message: Message) => {
      if (message.typeId !== "text") return;

      if (message.content.text === "/create") {
        console.log("Creating group");
        const group = await createGroup(
          client.client,
          message.sender.address,
          client.address as string,
        );
        await client.send({
          message: `Group created!\n- ID: ${group?.id}\n- Group URL: https://xmtp.chat/conversations/${group?.id}: \n- This url will deeplink to the group created\n- Once in the other group you can share the invite with your friends.`,
          originalMessage: message,
        });
        return;
      } else {
        await client.send({
          message:
            "👋 Welcome to the Gated Bot Group!\nTo get started, type /create to set up a new group. 🚀\nThis example will check if the user has a particular nft and add them to the group if they do.\nOnce your group is created, you'll receive a unique Group ID and URL.\nShare the URL with friends to invite them to join your group!",
          originalMessage: message,
        });
      }
    },
  });

  // Endpoint to add wallet address to a group from an external source
  const app = express();
  app.use(express.json());
  app.post("/add-wallet", (req: Request, res: Response) => {
    const { walletAddress, groupId } = req.body as {
      walletAddress: string;
      groupId: string;
    };
    // const verified = true; // (await checkNft(walletAddress, "XMTPeople"));
    // if (!verified) {
    //   console.log("User cant be added to the group");
    //   return;
    // } else {
    addToGroup(groupId, client.client as Client, walletAddress, true)
      .then(() => {
        res.status(200).send("success");
      })
      .catch((error: unknown) => {
        res.status(400).send((error as Error).message);
      });
  });
  // Start the servfalcheer
  const PORT = process.env.PORT || 3000;
  const url = process.env.URL || `http://localhost:${PORT}`;
  app.listen(PORT, () => {
    console.warn(
      `Use this endpoint to add a wallet to a group indicated by the groupId\n${url}/add-wallet <body: {walletAddress, groupId}>`,
    );
  });
  console.log(
    `XMTP agent initialized on ${client.address}\nSend a message on http://xmtp.chat/dm/${client.address}`,
  );
}

main().catch(console.error);

export async function createGroup(
  client: Client | undefined,
  senderAddress: string,
  clientAddress: string,
) {
  if (!client) {
    throw new Error("Client not initialized");
  }
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

export async function checkNft(
  walletAddress: string,
  collectionSlug: string,
): Promise<boolean> {
  const alchemy = new Alchemy(settings);
  try {
    const nfts = await alchemy.nft.getNftsForOwner(walletAddress);

    const ownsNft = nfts.ownedNfts.some(
      (nft) =>
        nft.contract.name?.toLowerCase() === collectionSlug.toLowerCase(),
    );
    console.log("is the nft owned: ", ownsNft);
    return ownsNft;
  } catch (error) {
    console.error("Error fetching NFTs from Alchemy:", error);
  }

  return false;
}
