import { xmtpClient, type Message } from "@xmtp/agent-starter";
import OpenAI from "openai";

// Initialize OpenAI API
const openai = new OpenAI();

async function main() {
  const client = await xmtpClient({
    walletKey: process.env.WALLET_KEY as string,
    onMessage: async (message: Message) => {
      console.log(
        `Decoded message: ${message.content.text} by ${message.sender.address}`,
      );

      // Send message content to GPT API
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "developer", content: "You are a helpful assistant." },
          {
            role: "user",
            content: message.content.text ?? "",
          },
        ],
      });

      const gptMessage = completion.choices[0]?.message?.content?.trim();

      // Use GPT response in your application
      await client.send({
        message: gptMessage ?? "",
        originalMessage: message,
      });
    },
  });

  console.log(
    `XMTP agent initialized on ${client.address}\nSend a message on http://xmtp.chat/dm/${client.address}`,
  );
}

main().catch(console.error);
