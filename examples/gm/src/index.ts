import { xmtpClient, type Message } from "@xmtp/agent-starter";

async function main() {
  const client = await xmtpClient({
    walletKey: process.env.WALLET_KEY as string,
    onMessage: async (message: Message) => {
      console.log(
        `Decoded message: ${message.content.text} by ${message.sender.address}`,
      );
      await client.send({
        message: "gm",
        originalMessage: message,
      });
    },
  });

  console.log(
    `XMTP agent initialized on ${client.address}\nSend a message on http://xmtp.chat/dm/${client.address}`,
  );
}

main().catch(console.error);
