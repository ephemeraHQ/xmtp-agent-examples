import { Agent } from "@xmtp/agent-sdk";
import OpenAI from "openai";

if (
  !process.env.GAIA_NODE_URL ||
  !process.env.GAIA_API_KEY ||
  !process.env.GAIA_MODEL_NAME
) {
  throw new Error(
    "GAIA_NODE_URL, GAIA_API_KEY, and GAIA_MODEL_NAME must be set",
  );
}

/* Initialize the OpenAI client */
const openai = new OpenAI({
  baseURL: process.env.GAIA_NODE_URL,
  apiKey: process.env.GAIA_API_KEY,
});

const agent = await Agent.create();

agent.on("message", async (ctx) => {
  try {
    /* Get the AI response */
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: ctx.message.content as string }],
      model: process.env.GAIA_MODEL_NAME as string,
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
  console.log("We are online");
});

void agent.start();
