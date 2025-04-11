import { createSigner, getEncryptionKeyFromHex } from "./helpers/client";
import { logAgentDetails, validateEnvironment } from "./helpers/utils";
import { Client, IdentifierKind, KeyPackageStatus, type XmtpEnv } from "@xmtp/node-sdk";

/* Get the wallet key associated to the public key of
 * the agent and the encryption key for the local db
 * that stores your agent's messages */
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

/* Create the signer using viem and parse the encryption key for the local db */
const signer = createSigner(WALLET_KEY);
const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

async function main() {
  const client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
  });

  const identifier = await signer.getIdentifier();
  const address = identifier.identifier;
  logAgentDetails(address, client.inboxId, XMTP_ENV);

  console.log("✓ Syncing conversations...");
  await client.conversations.sync();

  console.log("Waiting for messages...");
  const stream = await client.conversations.streamAllMessages();

  for await (const message of stream) {
    if (
      message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase() ||
      message?.contentType?.typeId !== "text"
    ) {
      continue;
    }

    const conversation = await client.conversations.getConversationById(
      message.conversationId,
    );

    if (!conversation) {
      console.log("Unable to find conversation, skipping");
      continue;
    }

    // Get the message content
    const content = message.content as string;
    
    // Only process messages that start with "/key-check"
    if (!content.trim().startsWith("/key-check")) {
      continue;
    }

    console.log(`Received command: ${content}`);
    
    // Parse the command
    const parts = content.trim().split(/\s+/);
    const command = parts.length > 1 ? parts[1] : "";
    
    if (command === "help") {
      // Send help information
      const helpText = 
        "Available commands:\n" +
        "/key-check - Check key package status for the sender\n" +
        "/key-check inboxid <INBOX_ID> - Check key package status for a specific inbox ID\n" +
        "/key-check address <ADDRESS> - Check key package status for a specific address\n" +
        "/key-check help - Show this help message";
      
      await conversation.send(helpText);
      console.log("Sent help information");
      continue;
    }
    
    let targetInboxId = message.senderInboxId;
    let targetAddress = "";
    
    // Handle specific inbox ID or address lookup
    if (command === "inboxid" && parts.length > 2) {
      targetInboxId = parts[2];
      console.log(`Looking up inbox ID: ${targetInboxId}`);
    } else if (command === "address" && parts.length > 2) {
      targetAddress = parts[2];
      console.log(`Looking up address: ${targetAddress}`);
      
      // Need to find the inbox ID for this address
      try {
        const inboxId = await client.getInboxIdByIdentifier({identifier: targetAddress, identifierKind: IdentifierKind.Ethereum});
        if (!inboxId) {
          await conversation.send(`No inbox found for address ${targetAddress}`);
          continue;
        }
        targetInboxId = inboxId;
      } catch (error) {
        console.error(`Error resolving address ${targetAddress}:`, error);
        await conversation.send(`Error resolving address ${targetAddress}`);
        continue;
      }
    }
    
    // Get inbox state for the target inbox ID
    try {
      const inboxState = await client.preferences.inboxStateFromInboxIds([
        targetInboxId,
      ]);
      
      if (!inboxState || inboxState.length === 0) {
        await conversation.send(`No inbox state found for ${targetInboxId}`);
        continue;
      }
      
      const addressFromInboxId = inboxState[0].identifiers[0].identifier;

      // Retrieve all the installation ids for the target
      const installationIds = inboxState[0].installations.map(
        (installation) => installation.id,
      );

      // Retrieve a map of installation id to KeyPackageStatus
      const status: Record<string, KeyPackageStatus | undefined> =
        await client.getKeyPackageStatusesForInstallationIds(installationIds);
      console.log(status);

      // Count valid and invalid installations
      const totalInstallations = Object.keys(status).length;
      const validInstallations = Object.values(status).filter(
        (value) => !value?.validationError
      ).length;
      const invalidInstallations = totalInstallations - validInstallations;

      // Create and send a human-readable summary with abbreviated IDs
      let summaryText = `InboxID: \n"${targetInboxId}" \nAddress: \n"${addressFromInboxId}" \n You have ${totalInstallations} installations, ${validInstallations} of them are valid and ${invalidInstallations} of them are invalid.\n\n`;
      for (const [installationId, installationStatus] of Object.entries(status)) {
        // Abbreviate the installation ID (first 4 and last 4 characters)
        const shortId = installationId.length > 8 
          ? `${installationId.substring(0, 4)}...${installationId.substring(installationId.length - 4)}`
          : installationId;
          
        if (installationStatus?.lifetime) {
          const createdDate = new Date(
            Number(installationStatus.lifetime.notBefore) * 1000,
          );
          const expiryDate = new Date(
            Number(installationStatus.lifetime.notAfter) * 1000,
          );
          
          summaryText += `✅ '${shortId}':\n`;
          summaryText += `- created: ${createdDate.toLocaleString()}\n`;
          summaryText += `- valid until: ${expiryDate.toLocaleString()}\n\n`;
        } else if (installationStatus?.validationError) {
          summaryText += `❌ '${shortId}':\n`;
          summaryText += `- validationError: '${installationStatus.validationError}'\n\n`;
        }
      }
      
      await conversation.send(summaryText);
      console.log(`Sent key status for ${targetInboxId}`);
    } catch (error) {
      console.error(`Error processing key-check for ${targetInboxId}:`, error);
      await conversation.send(`Error processing key-check: ${error.message}`);
    }

    console.log("Waiting for messages...");
  }
}

main().catch(console.error);
