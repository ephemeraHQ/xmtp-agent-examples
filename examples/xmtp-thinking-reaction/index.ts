import {
  Agent,
  getTestUrl,
  type MessageContext,
  type AgentMiddleware,
} from "@xmtp/agent-sdk";
import {
  ContentTypeReaction,
  ReactionCodec,
  type Reaction,
} from "@xmtp/content-type-reaction";

process.loadEnvFile(".env");

// Helper function to sleep for a specified number of milliseconds
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Extended context type to include thinking reaction helpers
interface ThinkingReactionContext extends MessageContext {
  thinkingReaction?: {
    removeThinkingEmoji: () => Promise<void>;
  };
}

// Middleware for thinking reaction pattern
const thinkingReactionMiddleware: AgentMiddleware = async (ctx, next) => {
  try {
    console.log("🤔 Reacting with thinking emoji...");

    // Step 1: Add thinking emoji reaction
    await ctx.conversation.send(
      {
        action: "added",
        content: "⏳",
        reference: ctx.message.id,
        schema: "shortcode",
      } as Reaction,
      ContentTypeReaction,
    );

    // Step 2: Add helper function to remove the thinking emoji
    const removeThinkingEmoji = async () => {
      await ctx.conversation.send(
        {
          action: "removed",
          content: "⏳",
          reference: ctx.message.id,
          schema: "shortcode",
        } as Reaction,
        ContentTypeReaction,
      );
    };

    // Attach helper to context
    (ctx as ThinkingReactionContext).thinkingReaction = {
      removeThinkingEmoji,
    };

    // Continue to next middleware/handler
    await next();
  } catch (error) {
    console.error("Error in thinking reaction middleware:", error);
    // Continue anyway
    await next();
  }
};

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  codecs: [new ReactionCodec()],
});

// Apply the thinking reaction middleware
agent.use(thinkingReactionMiddleware);

agent.on("text", async (ctx) => {
  const thinkingCtx = ctx as ThinkingReactionContext;

  try {
    const messageContent = ctx.message.content;
    console.log(`Received message: ${messageContent}`);

    // Step 1: Sleep for 2 seconds (thinking emoji already shown by middleware)
    console.log("💤 Sleeping for 2 seconds...");
    await sleep(2000);

    // Step 2: Send response
    console.log("💭 Sending response...");
    await ctx.sendText(
      "I've been thinking about your message and here's my response!",
    );

    // Step 3: Remove thinking emoji after sending the response
    if (thinkingCtx.thinkingReaction?.removeThinkingEmoji) {
      console.log("🗑️ Removing thinking emoji...");
      await thinkingCtx.thinkingReaction.removeThinkingEmoji();
    }

    console.log("✅ Response sent successfully");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing message:", errorMessage);

    // Still try to remove thinking emoji on error
    if (thinkingCtx.thinkingReaction?.removeThinkingEmoji) {
      try {
        await thinkingCtx.thinkingReaction.removeThinkingEmoji();
      } catch (removeError) {
        console.error("Error removing thinking emoji:", removeError);
      }
    }
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗${getTestUrl(agent)}`);
});

void agent.start();
