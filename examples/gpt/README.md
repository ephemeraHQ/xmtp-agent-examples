# GPT Agent

This example uses the [OpenAI](https://openai.com) API for GPT-based responses and the [XMTP](https://xmtp.org) protocol for secure messaging. You can test your agent on [xmtp.chat](https://xmtp.chat) or any other XMTP-compatible client.

## Environment variables

Add the following keys to a `.env` file:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # a second random 32 bytes encryption key for local db encryption
OPENAI_API_KEY= # the API key for the OpenAI API
```

## Usage

```tsx
import { Message, xmtpClient } from "@xmtp/agent-starter";
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI();

async function main() {
  const agent = await xmtpClient({
    encryptionKey: process.env.ENCRYPTION_KEY as string,
    onMessage: async (message: Message) => {
      console.log(
        `Decoded message: ${message?.content.text} from ${message.sender.address}`,
      );

      // Send user text to OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: message?.content.text ?? "" },
        ],
      });

      // Extract GPT response
      const gptMessage = completion.choices[0]?.message?.content?.trim();

      // Send GPT response back via XMTP
      await agent.send({
        message: gptMessage ?? "",
        originalMessage: message,
      });
    },
  });

  console.log(
    `XMTP agent initialized on ${agent.address}\n` +
      `Try sending a message at https://xmtp.chat/dm/${agent.address}`,
  );
}

main().catch(console.error);
```

Run the agent and send a test message from [xmtp.chat](https://xmtp.chat).  
Enjoy your GPT-powered XMTP agent!
