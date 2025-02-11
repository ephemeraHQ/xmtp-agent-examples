import { Client, type XmtpEnv } from "@xmtp/node-sdk";
import { Alchemy, Network } from "alchemy-sdk";
import { createSigner, getEncryptionKeyFromHex } from "@/helpers";

/* Set the Alchemy API key and network */
const settings = {
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
};

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY } = process.env;

if (!WALLET_KEY) {
  throw new Error("WALLET_KEY must be set");
}

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY must be set");
}

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

/* Set the environment to dev or production */
const env: XmtpEnv = "dev";

/**
 * Main function to run the agent
 */
async function main() {
  console.log(`Creating client on the '${env}' network...`);
  /* Initialize the xmtp client */
  const client = await Client.create(signer, encryptionKey, {
    env,
  });

  console.log("Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  console.log(
    `Agent initialized on ${client.accountAddress}\nSend a message on http://xmtp.chat/dm/${client.accountAddress}`,
  );

  console.log("Waiting for messages...");
  /* Stream all messages from the network */
  const stream = client.conversations.streamAllMessages();

  for await (const message of await stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    console.log(
      `Received message: ${message.content as string} by ${message.senderInboxId}`,
    );

    /* Get the conversation from the local db */
    const conversation = client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    /* If the message is to create a new group */
    if (message.content === "/create") {
      /* Create a new group */
      console.log("Creating group");
      const group = await client.conversations.newGroup([]);
      console.log("Group created", group.id);
      // First add the sender to the group
      await group.addMembersByInboxId([message.senderInboxId]);
      // Then make the sender a super admin
      await group.addSuperAdmin(message.senderInboxId);
      console.log(
        "Sender is superAdmin",
        group.isSuperAdmin(message.senderInboxId),
      );
      await group.send(
        `Welcome to the new group!\nYou are now the admin of this group as well as the bot`,
      );

      await conversation.send(
        `Group created!\n- ID: ${group.id}\n- Group URL: https://xmtp.chat/conversations/${group.id}: \n- This url will deeplink to the group created\n- Once in the other group you can share the invite with your friends.\n- You can add more members to the group by using the /add <group_id> <wallet_address>.`,
      );
      return;
    } else if (
      typeof message.content === "string" &&
      message.content.startsWith("/add")
    ) {
      /* Extract the group id and wallet address from the message */
      const groupId = message.content.split(" ")[1];
      if (!groupId) {
        await conversation.send("Please provide a group id");
        return;
      }
      /* Get the group from the local db */
      const group = client.conversations.getConversationById(groupId);
      if (!group) {
        await conversation.send("Please provide a valid group id");
        return;
      }
      /* Extract the wallet address from the message */
      const walletAddress = message.content.split(" ")[2];
      if (!walletAddress) {
        await conversation.send("Please provide a wallet address");
        return;
      }
      /* Check if the user has the NFT */
      const result = await checkNft(walletAddress, "XMTPeople");
      if (!result) {
        console.log("User can't be added to the group");
        return;
      } else {
        /* Add the user to the group */
        await group.addMembers([walletAddress]);
        await conversation.send(
          `User added to the group\n- Group ID: ${groupId}\n- Wallet Address: ${walletAddress}`,
        );
      }
    } else {
      /* Send a welcome message to the user */
      await conversation.send(
        "👋 Welcome to the Gated Bot Group!\nTo get started, type /create to set up a new group. 🚀\nThis example will check if the user has a particular nft and add them to the group if they do.\nOnce your group is created, you'll receive a unique Group ID and URL.\nShare the URL with friends to invite them to join your group!",
      );
    }
  }
}

main().catch(console.error);

/**
 * Check if the user has the NFT
 * @param walletAddress - The wallet address of the user
 * @param collectionSlug - The slug of the collection
 * @returns true if the user has the NFT, false otherwise
 */
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
