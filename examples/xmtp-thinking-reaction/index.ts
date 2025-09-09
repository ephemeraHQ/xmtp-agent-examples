import { Agent, createSigner, createUser } from "@xmtp/agent-sdk";
import {
  ContentTypeReaction,
  ReactionCodec,
  type Reaction,
} from "@xmtp/content-type-reaction";

process.loadEnvFile(".env");

// Helper function to sleep for a specified number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const agent = await Agent.create(createSigner(createUser()), {
  codecs: [new ReactionCodec()],
});

agent.on("text", async (ctx) => {
  try {
    const messageContent = ctx.message.content;
    console.log(`Received message: ${messageContent}`);

    // Step 1: React with thinking emoji
    console.log("🤔 Reacting with thinking emoji...");
    await ctx.conversation.send(
      {
        action: "added",
        content: "⏳",
        reference: ctx.message.id,
        schema: "shortcode",
      } as Reaction,
      ContentTypeReaction,
    );

    // Step 2: Sleep for 2 seconds
    console.log("💤 Sleeping for 2 seconds...");
    await sleep(2000);

    // Step 3: Send response
    console.log("💭 Sending response...");
    await ctx.conversation.send(
      "I've been thinking about your message and here's my response!",
    );
    await ctx.conversation.send(
      {
        action: "removed",
        content: "⏳",
        reference: ctx.message.id,
        schema: "shortcode",
      } as Reaction,
      ContentTypeReaction,
    );
    console.log("✅ Response sent successfully");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing message:", errorMessage);
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...\n🔗${getTestUrl(agent)}`);
});

void agent.start();
