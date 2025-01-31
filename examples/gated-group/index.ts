import { ContentTypeText } from "@xmtp/content-type-text";
import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { Alchemy, Network } from "alchemy-sdk";
import express, { type Request, type Response } from "express";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API key
  network: Network.BASE_MAINNET, // Use the appropriate network
};

const { WALLET_KEY, ENCRYPTION_KEY } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

const env: XmtpEnv = "dev";

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = client.conversations.streamAllMessages();

  // Endpoint to add wallet address to a group from an external source
  const app = express();
  app.use(express.json());
  app.post("/add-wallet", (req: Request, res: Response) => {
    const { walletAddress, groupId } = req.body as {
      walletAddress: string;
      groupId: string;
    };
    checkNft(walletAddress, "XMTPeople")
      .then((result) => {
        if (!result) {
          console.log("User cant be added to the group");
          return;
        } else {
          return addToGroup(groupId, client, walletAddress, true);
        }
      })
      .then(() => {
        res.status(200).send("success");
      })
      .catch((error: unknown) => {
        console.error("Error in checkNft or addToGroup:", error);
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
    `XMTP agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}`,
  );

  for await (const message of await stream) {
    if (
      !message ||
      !message.contentType ||
      !ContentTypeText.sameAs(message.contentType)
    ) {
      console.log("Invalid message, skipping", message);
      continue;
    }

    // Ignore own messages
    if (message.senderInboxId === client.inboxId) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    const conversation = client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    if (message.content === "/create") {
      console.log("Creating group");

      const group = await client.conversations.newGroup([
        client.accountAddress,
      ]);
      console.log("Group created", group.id);
      await group.addSuperAdmin(message.senderInboxId);
      console.log(
        "Sender is superAdmin",
        group.isSuperAdmin(message.senderInboxId),
      );
      await group.send(`Welcome to the new group!`);
      await group.send(
        `You are now the admin of this group as well as the bot`,
      );

      await conversation.send(
        `Group created!\n- ID: ${group.id}\n- Group URL: https://xmtp.chat/conversations/${group.id}: \n- This url will deeplink to the group created\n- Once in the other group you can share the invite with your friends.`,
      );
      return;
    } else {
      await conversation.send(
        "👋 Welcome to the Gated Bot Group!\nTo get started, type /create to set up a new group. 🚀\nThis example will check if the user has a particular nft and add them to the group if they do.\nOnce your group is created, you'll receive a unique Group ID and URL.\nShare the URL with friends to invite them to join your group!",
      );
    }
  }
}

main().catch(console.error);

async function checkNft(
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

async function addToGroup(
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
