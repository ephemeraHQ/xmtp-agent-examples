import { Agent } from "@xmtp/agent-sdk";
import {
  ContentTypeReaction,
  ReactionCodec,
  type Reaction,
} from "@xmtp/content-type-reaction";

// Helper function to sleep for a specified number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const agent = await Agent.create({
  codecs: [new ReactionCodec()],
});

agent.on("message", async (ctx) => {
  try {
    const messageContent = ctx.message.content as string;
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
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online: ${url}`);
});

void agent.start();
