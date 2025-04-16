import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { Client, IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

// Define the address to always add to new groups
const MEMBER_ADDRESS = "0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204";

async function main() {
  // Initialize client
  const signer = createSigner(WALLET_KEY);
  const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
  const client = await Client.create(signer, {
    dbEncryptionKey,
    env: XMTP_ENV as XmtpEnv,
  });

  logAgentDetails(client);

  console.log("✓ Syncing conversations...");
  /* Sync the conversations from the network to update the local db */
  await client.conversations.sync();

  // Start listening for messages
  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    try {
      // Get message content
      const messageContent = message.content as string;
      console.log(`Received message: ${messageContent}`);

      // Check if the message is a number
      const number = Number(messageContent.trim());
      if (isNaN(number)) {
        // If not a number, reply with instructions
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );
        if (conversation) {
          await conversation.send("Please send a number value only.");
        }
        continue;
      }

      // Calculate the multiplied result
      const result = number * 2;
      console.log(`Multiplied result: ${result}`);

      // Get the original conversation to reply
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("Could not find the conversation for the message");
        continue;
      }

      // Get sender inbox ID for new group creation
      const senderInboxId = message.senderInboxId;

      // Create a group name based on the multiplied result
      const groupName = `Number Multiplier: ${result}`;

      // Create a new group including the sender
      console.log(
        `Creating group "${groupName}" with sender ${senderInboxId}...`,
      );

      const group = await client.conversations.newGroup([senderInboxId], {
        groupName: groupName,
        groupDescription: "Group created by number multiplier agent",
      });

      // Add the specified address as a member
      await group.addMembersByIdentifiers([
        {
          identifier: MEMBER_ADDRESS,
          identifierKind: IdentifierKind.Ethereum,
        },
      ]);

      // Send result as response in the group
      const responseMessage = `Original number: ${number}\nMultiplied by 2: ${result}`;
      await group.send(responseMessage);

      // Reply to original conversation
      await conversation.send(
        `Created group "${groupName}" with the result. Check your groups.`,
      );

      console.log(`Group "${groupName}" created successfully`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error processing message:", errorMessage);

      // Try to send an error response
      try {
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );
        if (conversation) {
          await conversation.send(
            "Sorry, I encountered an error processing your number.",
          );
        }
      } catch (sendError) {
        console.error(
          "Failed to send error message:",
          sendError instanceof Error ? sendError.message : String(sendError),
        );
      }
    }
  }
}

main().catch(console.error);
