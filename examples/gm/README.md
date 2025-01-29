## GM agent

> Try XMTP using [xmtp.chat](https://xmtp.chat)

This agent replies GM

```tsx
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
