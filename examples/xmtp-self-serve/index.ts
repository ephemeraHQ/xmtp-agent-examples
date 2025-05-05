import { validateEnvironment } from "@helpers/client";
import type { Client, Conversation, DecodedMessage } from "@xmtp/node-sdk";
import { initializeClient } from "./xmtp-handler";

const { WALLET_KEY } = validateEnvironment(["WALLET_KEY"]);
const processMessage = async (
  client: Client,
  conversation: Conversation,
  message: DecodedMessage,
  isDm: boolean,
) => {
  console.log("Environment: ", client.options?.env);
  console.log("Agent address: ", client.accountIdentifier?.identifier);
  console.log("Message received from ", message.senderInboxId);
  console.log("Message content: ", message.content);
  console.log("Is DM: ", isDm);
  console.log("Dm/Group ID: ", conversation.id);
  /**
   *
   * Your logic here
   * Reply to the message for example
   */
  await conversation.send("gm");
};

await initializeClient(processMessage, [
  {
    acceptGroups: true,
    walletKey: WALLET_KEY,
  },
]);
