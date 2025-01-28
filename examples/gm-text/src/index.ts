import { send, xmtpClient, type DecodedMessage } from "./lib/helper.js";

async function main() {
  const client = await xmtpClient({
    onMessage: async (message: DecodedMessage) => {
      console.log(message);
      await send("gm", message.senderInboxId, client);
    },
  });

  console.log(
    `XMTP agent initialized on ${client.accountAddress}\nSend a message on https://xmtp.chat/dm/${client.accountAddress}`,
  );
}

main().catch(console.error);
