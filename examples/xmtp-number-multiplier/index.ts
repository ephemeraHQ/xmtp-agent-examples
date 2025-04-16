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

      // Check if the message is a valid number
      const number = Number(messageContent);

      if (isNaN(number)) {
        console.log("Message is not a valid number, skipping");
        continue;
      }

      // Multiply the number by 2
      const result = number * 2;
      console.log(`Multiplied ${number} by 2: ${result}`);

      // Get the conversation to reply to the sender
      const conversation = await client.conversations.getConversationById(
        message.conversationId,
      );

      if (!conversation) {
        console.log("Could not find the conversation for the message");
        continue;
      }

      // Get the sender's inbox ID
      const senderInboxId = message.senderInboxId;

      // Create a group name based on the message content
      const groupName = `Multiplier result for ${number}`;

      // Create a new group including the sender and the specified address
      console.log(
        `Creating group "${groupName}" with sender ${senderInboxId}...`,
      );

      // Create group with sender first
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

      // Send the result in the group
      await group.send(`The number ${number} multiplied by 2 is: ${result}`);

      // Also send a confirmation in the original conversation
      await conversation.send(
        `I've created a group named "${groupName}" with you and ${MEMBER_ADDRESS} and shared the result there.`,
      );

      console.log(`Group "${groupName}" created successfully and result sent`);
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
