import { send, xmtpClient, type DecodedMessage } from "./lib/helper.js";

async function main() {
  const client = await xmtpClient({
    onMessage: async (message: DecodedMessage, senderAddress: string) => {
      console.log(`Decoded message: ${message.content} from ${senderAddress}`);
      await send("gm", senderAddress, client);
    },
  });

  console.log(
    `XMTP agent initialized on ${client.accountAddress}\nSend a message on https://xmtp.chat/dm/${client.accountAddress}`,
  );
}

main().catch(console.error);
