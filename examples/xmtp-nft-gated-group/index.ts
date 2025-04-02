import "dotenv/config";
import { createSigner, getEncryptionKeyFromHex } from "@helpers";
import {
  Client,
  IdentifierKind,
  type Group,
  type XmtpEnv,
} from "@xmtp/node-sdk";
import { Alchemy, Network } from "alchemy-sdk";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
if (!ALCHEMY_API_KEY) {
  throw new Error("ALCHEMY_API_KEY must be set");
}

const NFT_COLLECTION_SLUG = "XMTPeople";
const settings = {
  apiKey: ALCHEMY_API_KEY,
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

/* Set the environment to local, dev or production */
const env: XmtpEnv = process.env.XMTP_ENV as XmtpEnv;

async function main() {
  console.log(`Creating client on the '${env}' network...`);
  const client = await Client.create(signer, encryptionKey, {
    env,
  });

  console.log("Syncing conversations...");
  await client.conversations.sync();

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;

  console.log(
    `Agent initialized on ${address}\nSend a message on http://xmtp.chat/dm/${address}?env=${env}`,
  );

  console.log("Waiting for messages...");
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

    const conversation = client.conversations.getDmByInboxId(
      message.senderInboxId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    /* This example works by parsing slash commands to create a new group or add a member to a group
     * /create - create a new group
     * /add <group_id> <wallet_address> - add a member to a group */

    if (message.content === "/create") {
      console.log("Creating group");
      const group = await client.conversations.newGroup([]);
      console.log("Group created", group.id);
      // First add the sender to the group
      await group.addMembers([message.senderInboxId]);
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
      const groupId = message.content.split(" ")[1];
      if (!groupId) {
        await conversation.send("Please provide a group id");
        return;
      }
      const group = await client.conversations.getConversationById(groupId);
      if (!group) {
        await conversation.send("Please provide a valid group id");
        return;
      }
      const walletAddress = message.content.split(" ")[2];
      if (!walletAddress) {
        await conversation.send("Please provide a wallet address");
        return;
      }
      const result = await checkNft(walletAddress, NFT_COLLECTION_SLUG);
      if (!result) {
        console.log("User can't be added to the group");
        return;
      } else {
        await (group as Group).addMembersByIdentifiers([
          {
            identifierKind: IdentifierKind.Ethereum,
            identifier: walletAddress,
          },
        ]);
        await conversation.send(
          `User added to the group\n- Group ID: ${groupId}\n- Wallet Address: ${walletAddress}`,
        );
      }
    } else {
      await conversation.send(
        "Available commands:\n\n" +
          "/create - Create a new gated group\n" +
          "/add <group_id> <wallet_address> - Add a member to an existing group (requires XMTPeople NFT)\n" +
          "Note: The bot verifies NFT ownership before adding members to groups.",
      );
      return;
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
