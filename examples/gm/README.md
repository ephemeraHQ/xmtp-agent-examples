## GM agent

> Try XMTP using [xmtp.chat](https://xmtp.chat)

This agent replies GM

```tsx

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
import type { DecodedMessage } from "@xmtp/node-sdk";
import { createClient, getAddressFromInboxId } from "./xmtp.js";

async function main() {
  const client = await createClient({
    streamMessageCallback: async (message: DecodedMessage) => {
      const conversation = client.conversations.getConversationById(
        message.conversationId,
      );
      if (!conversation) {
        console.error("Conversation not found");
        return;
      }
      const senderAddress = await getAddressFromInboxId(
        conversation,
        message.senderInboxId,
      );
      console.log(`Decoded message: ${message.content} from ${senderAddress}`);

      await conversation.send("gm");
    },
  });

  console.log(
    `XMTP agent initialized on ${client.accountAddress}\nSend a message on https://xmtp.chat/dm/${client.accountAddress}`,
  );
}

main().catch(console.error);
```
