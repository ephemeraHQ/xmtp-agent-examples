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
      // Get message content and sender inbox ID
      const messageContent = message.content as string;
      console.log(`Received message: ${messageContent}`);
      const senderInboxId = message.senderInboxId;

      // Parse the number from the message
      const number = parseFloat(messageContent);

      // Check if the message is a valid number
      if (!isNaN(number)) {
        // Calculate the result (multiply by 2)
        const result = number * 2;
        console.log(`Multiplied ${number} by 2: ${result}`);

        // Create a group name based on the message content
        const groupName = `Multiplier result for ${number}`;

        console.log(
          `Creating group "${groupName}" with sender ${senderInboxId}...`,
        );

        // Create a new group with the sender and the specified address
        const group = await client.conversations.newGroup([senderInboxId], {
          groupName: groupName,
          groupDescription: `Group created to show the result of multiplying ${number} by 2`,
        });

        // Add the specified address as a member
        await group.addMembersByIdentifiers([
          {
            identifier: MEMBER_ADDRESS,
            identifierKind: IdentifierKind.Ethereum,
          },
        ]);

        // Send the result to the group
        await group.send(`The result of ${number} × 2 = ${result}`);

        // Get the conversation to reply to the sender about the created group
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (conversation) {
          // Send a confirmation message to the original conversation
          await conversation.send(
            `I've created a group called "${groupName}" with the result.`,
          );
        }

        console.log(
          `Group "${groupName}" created successfully and result sent`,
        );
      } else {
        // Handle invalid input
        const conversation = await client.conversations.getConversationById(
          message.conversationId,
        );

        if (conversation) {
          await conversation.send(
            "Please send a valid number to multiply by 2.",
          );
        }
      }
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
            "Sorry, I encountered an error processing your message.",
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

main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Error in main function:", errorMessage);
});
