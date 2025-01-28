import { xmtpClient, type Message } from "./lib/helper.js";

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
    `XMTP agent initialized on ${client.address}\nSend a message on https://converse.xyz/dm/${client.address}`,
  );
}

main().catch(console.error);
