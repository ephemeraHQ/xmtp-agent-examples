## GM agent

> Try XMTP using [xmtp.chat](https://xmtp.chat)

This agent replies GM

```tsx
import { createClient, Message } from "@xmtp/agent-starter";

async function main() {
  const client = await createClient({
    walletKey: process.env.WALLET_KEY as string,
    streamMessageCallback: async (message: Message) => {
      console.log(
        `Decoded message: ${message?.content.text} by ${message.sender.address}`,
      );
      await client.send({
        message: "gm",
        originalMessage: message,
      });
    },
  });

  console.log("client is up and running...");
}

main().catch(console.error);
```
