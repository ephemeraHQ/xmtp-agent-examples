# Building a gated group with NFT verification

To create a gated group chat using XMTP, you will need an admin bot within the group to manage member additions and removals. The admin bot will create the group, assign you as the admin, and then monitor the API endpoint to add each wallet individually.

#### Environment variables

```bash
ALCHEMY_API_KEY= #alchemy api to check NFT ownership
WALLET_KEY= # the private key of admin bot
ENCRYPTION_KEY= # a second fixed or random 32 bytes encryption key for the local db
```

## Start the XMTP agent

Start your XMTP client and begin listening to messages from the bot.

```tsx
const agent = await createClient({
  streamMessageCallback: async (message: Message) => {
    // Of message is /create then proceed to create a group.
    if (message?.content.text === "/create") {
      //This is a arbitrary trigger but you can embed this logic into any server.
      console.log("Creating group");
      const group = await createGroup(
        client?.client,
        message?.sender?.address as string,
        client?.address as string,
      );
      console.log("Group created", group?.id);
      await client.send({
        message: `Group created!\n- ID: ${group?.id}\n- Group URL: https://xmtp.chat/conversations/${group?.id}: \n- This url will deeplink to the group created\n- Once in the other group you can share the invite with your friends.`,
        originalMessage: message,
      });
      return;
    }
  },
});
```

## Vefify NFT ownership

The server provides a single endpoint to add a wallet address to a group—**but only if** the wallet holds the right NFT.

```tsx [src/index.ts]
app.post("/add-wallet", async (req, res) => {
  const { walletAddress, groupId } = req.body;
  const verified = await checkNft(walletAddress, "XMTPeople");
  if (!verified) {
    console.log("User cant be added to the group");
    return;
  } else {
    await addToGroup(groupId, agent?.client, walletAddress, true);
  }
}
```

**Key points:**

- `checkNft(walletAddress, "XMTPeople")`: a function (not shown here) that verifies if a wallet holds the “XMTPeople” NFT.
- Only verified addresses are added to the group with `addToGroup(...)`.
- The server logs important messages to keep you informed.

## Check the NFT with alchemy

```tsx
import { Alchemy, Network } from "alchemy-sdk";

const settings = {
  apiKey: process.env.ALCHEMY_API_KEY, // Replace with your Alchemy API key
  network: Network.BASE_MAINNET, // Use the appropriate network
};

export async function checkNft(
  walletAddress: string,
  collectionSlug: string,
): Promise<boolean> {
  const alchemy = new Alchemy(settings);
  try {
    const nfts = await alchemy.nft.getNftsForOwner(walletAddress);

    const ownsNft = nfts.ownedNfts.some(
      (nft: any) =>
        nft.contract.name.toLowerCase() === collectionSlug.toLowerCase(),
    );
    console.log("is the nft owned: ", ownsNft);
    return ownsNft as boolean;
  } catch (error) {
    console.error("Error fetching NFTs from Alchemy:", error);
  }

  return false;
}
```

## Create a gated group

Use the `createGroup` function to create a new group conversation and set both the user and the bot as super admins. Once created, you’ll have a `groupId` you can use to add others:

```tsx
export async function createGroup(
  client: Client,
  members: string[],
  senderAddress: string,
  clientAddress: string,
) {
  try {
    await client?.conversations.sync();
    const group = await client?.conversations.newGroup([members]);
    console.log("Group created", group?.id);

    // Grab members and find the sender
    const members = await group?.members();
    const senderMember = members?.find((member) =>
      member.accountAddresses.includes(senderAddress?.toLowerCase() ?? ""),
    );

    if (!senderMember) {
      console.log("Sender not found in members list");
      return undefined;
    }

    // Grant superAdmin privileges
    const senderInboxId = senderMember.inboxId;
    await group?.addSuperAdmin(senderInboxId);
    console.log(
      "Sender is superAdmin",
      await group?.isSuperAdmin(senderInboxId),
    );

    // Send welcome messages
    await group?.send(`Welcome to the new group!`);
    await group?.send(`You are now the admin of this group as well as the bot`);

    return group;
  } catch (error) {
    console.log("Error creating group", error);
    return undefined;
  }
}
```

## Sping a Express server

```tsx
// Endpoint to add wallet address to a group from an external source
const app = express();
app.use(express.json());
app.post("/add-wallet", async (req, res) => {
  /* Add wallet logic*/
});
// Start the servfalcheer
const PORT = process.env.PORT || 3000;
const url = process.env.URL || `http://localhost:${PORT}`;
app.listen(PORT, () => {
  console.warn(
    `Use this endpoint to add a wallet to a group indicated by the groupId\n${url}/add-wallet <body: {walletAddress, groupId}>`,
  );
});
```

## Test the Endpoint

Once your server is running (by default on port `3000`), test the `add-wallet` endpoint with your chosen wallet and the `groupId` you received from `createGroup`:

```bash
curl -X POST http://localhost:3000/add-wallet \
 -H "Content-Type: application/json" \
 -d '{"walletAddress": "0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204", "groupId": "5a785210f748ac8a5ec4a46e749a0c5d"}'
```

If the wallet is verified for your NFT, you should get a `"success"` response, and the user will be added to the group. Otherwise, you’ll see `"not verified"` or `"error"` in the response.
