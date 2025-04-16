import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { logAgentDetails, validateEnvironment } from "@helpers/utils";
import { Client, IdentifierKind, type XmtpEnv } from "@xmtp/node-sdk";

// Get environment variables
const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
  "WALLET_KEY",
  "ENCRYPTION_KEY",
  "XMTP_ENV",
]);

// Address to always add to the group
const ADDITIONAL_MEMBER = "0x93E2fc3e99dFb1238eB9e0eF2580EFC5809C7204";

async function main() {
  try {
    // Initialize client
    const signer = createSigner(WALLET_KEY);
    const dbEncryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);
    const client = await Client.create(signer, {
      dbEncryptionKey,
      env: XMTP_ENV as XmtpEnv,
    });

    // Log agent details to the console
    logAgentDetails(client);

    // Sync existing conversations
    console.log("✓ Syncing conversations...");
    await client.conversations.sync();

    console.log("Waiting for messages...");

    // Stream all messages
    const stream = client.conversations.streamAllMessages();

    for await (const message of stream) {
      try {
        // Skip messages sent by the agent itself
        if (
          message?.senderInboxId.toLowerCase() === client.inboxId.toLowerCase()
        ) {
          continue;
        }

        // Skip non-text messages
        if (message?.contentType?.typeId !== "text") {
          console.log("Skipping non-text message");
          continue;
        }

        const messageContent = message.content as string;
        console.log(`Received message: ${messageContent}`);

        // Check if message content is a number
        const inputNumber = parseFloat(messageContent);
        if (isNaN(inputNumber)) {
          console.log("Message is not a number, skipping");
          continue;
        }

        // Multiply the number by 2
        const result = inputNumber * 2;
        console.log(`Calculated result: ${result}`);

        // Get sender info to create a group
        const senderInboxId = message.senderInboxId;
        console.log(`Sender inbox ID: ${senderInboxId}`);

        // Resolve the additional member address to an inbox ID
        let additionalMemberInboxId;
        try {
          const resolvedInboxes = await client.address.resolveAddresses([
            ADDITIONAL_MEMBER,
          ]);
          additionalMemberInboxId = resolvedInboxes[0]?.inboxId;

          if (!additionalMemberInboxId) {
            console.log(
              `Could not resolve inbox ID for address: ${ADDITIONAL_MEMBER}`,
            );
            continue;
          }
        } catch (error) {
          console.error(
            `Error resolving address ${ADDITIONAL_MEMBER}:`,
            error instanceof Error ? error.message : String(error),
          );
          continue;
        }

        // Create a group with sender and the additional member
        const groupMembers = [senderInboxId, additionalMemberInboxId];
        console.log(`Creating group with members: ${groupMembers.join(", ")}`);

        const group = await client.conversations.newGroup(groupMembers, {
          groupName: `Number Result: ${inputNumber} × 2`,
          groupDescription: "Group created by number multiplier agent",
        });

        console.log(`Group created: ${group.id}, Name: ${group.name}`);

        // Send result message to the group
        await group.send(`The result of ${inputNumber} × 2 = ${result}`);
        console.log("Result message sent to group");

        // Get member info for the welcome message
        const memberDetails = [];
        const members = await group.members();

        for (const member of members) {
          try {
            const inboxState = await client.preferences.inboxStateFromInboxIds([
              member.inboxId,
            ]);
            if (inboxState.length > 0 && inboxState[0].identifiers.length > 0) {
              const address =
                inboxState[0].identifiers.find(
                  (id) => id.kind === IdentifierKind.Address,
                )?.identifier || "Unknown";

              const installationId =
                inboxState[0].identifiers.find(
                  (id) => id.kind === IdentifierKind.InstallationId,
                )?.identifier || "None";

              memberDetails.push({
                inboxId: member.inboxId,
                address,
                installationId,
              });
            }
          } catch (error) {
            console.error(
              `Error getting member details for ${member.inboxId}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        }

        // Send member info message to the group
        const memberInfoMessage = `Group members info:\n${memberDetails
          .map(
            (m) =>
              `- Address: ${m.address}\n  InboxID: ${m.inboxId}\n  Installation ID: ${m.installationId}`,
          )
          .join("\n\n")}`;

        await group.send(memberInfoMessage);
        console.log("Member info message sent to group");
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Error processing message:", errorMessage);
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fatal error:", errorMessage);
    process.exit(1);
  }
}

main().catch(console.error);
