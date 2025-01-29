import type { DecodedMessage } from "@xmtp/node-sdk";
import { Alchemy, Network } from "alchemy-sdk";
import express, { type Request, type Response } from "express";
import { addToGroup, createGroup } from "./groups.js";
import { createClient, getAddressFromInboxId } from "./xmtp.js";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API key
  network: Network.BASE_MAINNET, // Use the appropriate network
};

async function main() {
  const client = await createClient({
    walletKey: process.env.WALLET_KEY as string,
    streamMessageCallback: async (message: DecodedMessage) => {
      if (message.contentType?.typeId !== "text") return;
      const conversation = client.conversations.getConversationById(
        message.conversationId,
      );
      if (!conversation) {
        console.error("Conversation not found");
        return;
      }
      if (message.content === "/create") {
        console.log("Creating group");
        const senderAddress = await getAddressFromInboxId(
          conversation,
          message.senderInboxId,
        );

        const group = await createGroup(
          client,
          senderAddress,
          client.accountAddress,
        );
        await conversation.send(
          `Group created!\n- ID: ${group?.id}\n- Group URL: https://xmtp.chat/conversations/${group?.id}: \n- This url will deeplink to the group created\n- Once in the other group you can share the invite with your friends.`,
        );
        return;
      } else {
        await conversation.send(
          "👋 Welcome to the Gated Bot Group!\nTo get started, type /create to set up a new group. 🚀\nThis example will check if the user has a particular nft and add them to the group if they do.\nOnce your group is created, you'll receive a unique Group ID and URL.\nShare the URL with friends to invite them to join your group!",
        );
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
    const verified = true; // (await checkNft(walletAddress, "XMTPeople"));
    if (!verified) {
      console.log("User cant be added to the group");
      return;
    } else {
      addToGroup(groupId, client, walletAddress, true)
        .then(() => {
          res.status(200).send("success");
        })
        .catch((error: unknown) => {
          res.status(400).send((error as Error).message);
        });
    }
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
    `XMTP agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}`,
  );
}

main().catch(console.error);

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
