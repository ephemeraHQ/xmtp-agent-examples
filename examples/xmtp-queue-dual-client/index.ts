import { Agent, type AgentContext } from "@xmtp/agent-sdk";

// Message queue interface
interface QueuedMessage {
  conversationId: string;
  content: string;
  timestamp: number;
}

// Message queue
const messageQueue: QueuedMessage[] = [];

// Queue processing interval in milliseconds (1 second)
const PROCESS_INTERVAL = 1000;

// Sync interval in minutes (5 minutes)
const SYNC_INTERVAL = 5;

async function main(): Promise<void> {
  console.log("Starting XMTP Queue Dual Client Agent...");

  // Create receiving client
  const receivingClient = await Agent.create(undefined, {
    dbPath: getDbPath(XMTP_ENV + "-receiving"),
  });

  console.log("XMTP receiving client created");

  // Create sending client
  const sendingClient = await Agent.create(undefined, {
    dbPath: getDbPath(XMTP_ENV + "-sending"),
  });

  // Start periodic sync for both clients
  startPeriodicSync(receivingClient, sendingClient);

  // Start message processor with sending client
  startMessageProcessor(sendingClient);

  // Start message stream with receiving client
  void setupMessageStream(receivingClient);

  process.stdin.resume(); // Keep process running
}

/**
 * Start periodic sync for both clients
 */
function startPeriodicSync(
  receivingClient: AgentContext,
  sendingClient: AgentContext,
): void {
  console.log(`Setting up periodic sync every ${SYNC_INTERVAL} minutes`);

  setInterval(
    () => {
      void (async () => {
        console.log("Syncing receiving client...");
        await receivingClient.client.conversations.sync();
        console.log("Receiving client synced successfully");

        console.log("Syncing sending client...");
        await sendingClient.client.conversations.sync();
        console.log("Sending client synced successfully");
      })();
    },
    SYNC_INTERVAL * 60 * 1000, // 5 minutes in milliseconds
  );
}

async function setupMessageStream(client: AgentContext): Promise<void> {
  console.log("Setting up message stream on receiving client...");
  const stream = await client.client.conversations.streamAllMessages();
  console.log("Message stream started successfully");

  // Process incoming messages
  for await (const message of stream) {
    /* Ignore messages from the same agent or non-text messages */
    if (
      message.senderInboxId.toLowerCase() ===
      client.client.inboxId.toLowerCase()
    ) {
      continue;
    }

    /* Ignore non-text messages */
    if (message.contentType?.typeId !== "text") {
      continue;
    }
    const content = message.content as string;
    console.log(
      `Received: "${content}" in conversation ${message.conversationId}`,
    );

    // Queue response
    const response = `Reply to: "${content}" at ${new Date().toISOString()}`;
    messageQueue.push({
      conversationId: message.conversationId,
      content: response,
      timestamp: Date.now(),
    });

    console.log(`Queued response for conversation ${message.conversationId}`);
  }
}

function startMessageProcessor(client: AgentContext): void {
  console.log("Starting message processor on sending client...");
  // Process message queue periodically
  setInterval(() => {
    void processMessageQueue(client);
  }, PROCESS_INTERVAL);
}

async function processMessageQueue(ctx: AgentContext): Promise<void> {
  if (messageQueue.length === 0) return;

  // Process in FIFO order (oldest first)
  const message = messageQueue.shift();
  if (!message) return;

  await ctx.conversation.sync();

  // Send message
  await ctx.conversation.send(message.content);
  console.log(`Message sent successfully: "${message.content}"`);
}

// Start the application
void main();
