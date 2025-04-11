import { createSigner, getEncryptionKeyFromHex } from "@helpers/client";
import { validateEnvironment } from "@helpers/utils";
import { Client, XmtpEnv } from "@xmtp/node-sdk";
import { NextRequest, NextResponse } from "next/server";

let client: Client | null = null;
let serverInfo: { address: string; inboxId: string; env: string } | null = null;

// Initialize the server
async function initializeServer() {
  if (client && serverInfo) {
    return serverInfo;
  }

  const { WALLET_KEY, ENCRYPTION_KEY, XMTP_ENV } = validateEnvironment([
    "WALLET_KEY",
    "ENCRYPTION_KEY",
    "XMTP_ENV",
  ]);

  const signer = createSigner(WALLET_KEY);
  const encryptionKey = getEncryptionKeyFromHex(ENCRYPTION_KEY);

  client = await Client.create(signer, encryptionKey, {
    env: XMTP_ENV as XmtpEnv,
  });

  // Start listening for messages
  console.log("Server initialized, listening for messages...");
  const stream = await client.conversations.streamAllMessages();

  (async () => {
    for await (const message of stream) {
      if (
        message?.senderInboxId?.toLowerCase() ===
          client?.inboxId?.toLowerCase() ||
        message?.contentType?.typeId !== "text"
      ) {
        continue;
      }

      try {
        const conversation = await client?.conversations.getConversationById(
          message.conversationId,
        );

        if (!conversation) {
          console.log("Could not find conversation for message");
          continue;
        }

        // Reply with "gm"
        await conversation.send("gm");
        console.log("Replied with 'gm' to message:", message.content);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    }
  })().catch(console.error);

  serverInfo = {
    address: (await signer.getIdentifier()).identifier,
    inboxId: client.inboxId,
    env: XMTP_ENV,
  };

  return serverInfo;
}

// GET handler to return server info
export async function GET() {
  try {
    const info = await initializeServer();
    return NextResponse.json(info);
  } catch (error) {
    console.error("Error initializing server:", error);
    return NextResponse.json(
      { error: "Failed to initialize server" },
      { status: 500 },
    );
  }
}

// POST handler to send a message
export async function POST(request: NextRequest) {
  try {
    if (!client) {
      await initializeServer();
    }

    const { message, clientAddress } = await request.json();

    if (!message || !clientAddress) {
      return NextResponse.json(
        { error: "Message and client address are required" },
        { status: 400 },
      );
    }

    // Create a conversation with the client
    const conversation = await client!.conversations.newDmWithIdentifier({
      identifier: clientAddress,
      identifierKind: "Ethereum",
    });

    // Send the message
    await conversation.send(message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
