import { Agent } from "@xmtp/agent-sdk";
import OpenAI from "openai";

process.loadEnvFile(".env");

/* Initialize the OpenAI client */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const agent = await Agent.create();

agent.on("message", async (ctx) => {
  const messageContent = ctx.message.content as string;

  console.log(
    `Received message: ${messageContent} by ${ctx.message.senderInboxId}`,
  );

  try {
    /* Get the AI response */
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: messageContent }],
      model: "gpt-4o-mini",
    });

    /* Get the AI response */
    const response =
      completion.choices[0]?.message?.content ||
      "I'm not sure how to respond to that.";

    console.log(`Sending AI response: ${response}`);
    /* Send the AI response to the conversation */
    await ctx.conversation.send(response);
  } catch (error) {
    console.error("Error getting AI response:", error);
    await ctx.conversation.send(
      "Sorry, I encountered an error processing your message.",
    );
  }
});

agent.on("start", () => {
  const address = agent.client.accountIdentifier?.identifier;
  const env = agent.client.options?.env;
  const url = `http://xmtp.chat/dm/${address}?env=${env}`;
  console.log(`We are online: ${url}`);
});

void agent.start();
