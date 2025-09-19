import { Agent, getTestUrl } from "@xmtp/agent-sdk";

process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
});

// Handle DM messages
agent.on("dm", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();
  console.log(`New DM conversation started with ${senderAddress}`);

  await ctx.sendText(
    `👋 Hello! I'm a DM-only agent. I only respond to direct messages, not group messages.\n\n` +
      `You can send me any text message and I'll echo it back with some additional info!`,
  );
});

// Handle text messages in DMs
agent.on("text", async (ctx) => {
  // Only respond to DMs, ignore group messages
  if (ctx.isDm()) {
    const messageContent = ctx.message.content;
    const senderAddress = await ctx.getSenderAddress();
    const conversationId = ctx.conversation.id;

    console.log(`DM received from ${senderAddress}: ${messageContent}`);

    // Echo the message with additional context
    await ctx.sendText(
      `📨 **Message received!**\n\n` +
        `**Your message:** "${messageContent}"\n` +
        `**From:** ${senderAddress}\n` +
        `**Conversation ID:** ${conversationId.slice(0, 8)}...\n\n` +
        `This is a DM-only agent - I only respond to direct messages! 💬`,
    );
  }
});

// Handle reactions in DMs
agent.on("reaction", async (ctx) => {
  if (ctx.isDm()) {
    const senderAddress = await ctx.getSenderAddress();
    const reaction = ctx.message.content;

    console.log(`Reaction received from ${senderAddress}: ${reaction}`);

    await ctx.sendText(
      `😊 Thanks for the reaction: ${reaction}\n\n` +
        `I see you're engaging with my messages! Feel free to send me any text message.`,
    );
  }
});

// Handle replies in DMs
agent.on("reply", async (ctx) => {
  if (ctx.isDm()) {
    const senderAddress = await ctx.getSenderAddress();
    const replyContent = ctx.message.content;
    const reference = ctx.message.content.reference;

    console.log(`Reply received from ${senderAddress}: ${replyContent}`);

    await ctx.sendText(
      `↩️ **Reply received!**\n\n` +
        `**Your reply:** "${replyContent}"\n` +
        `**Replying to message:** ${reference.slice(0, 8)}...\n\n` +
        `Thanks for the reply! I'm here to help with any questions you might have.`,
    );
  }
});

// Handle unhandled errors
agent.on("unhandledError", (error) => {
  console.error("Agent error:", error);
});

// Log when agent starts
agent.on("start", () => {
  console.log(`🤖 DM Agent is running...`);
  console.log(`📍 Address: ${agent.client.accountIdentifier?.identifier}`);
  console.log(`🔗 Test URL: ${getTestUrl(agent)}`);
  console.log(`💬 This agent only responds to direct messages (DMs)`);
  console.log(`📝 Send me a message to get started!`);
});

await agent.start();

