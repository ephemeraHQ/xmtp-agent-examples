import { Agent } from "@xmtp/agent-sdk";
import { getTestUrl } from "@xmtp/agent-sdk/debug";
import OpenAI from "openai";
import { loadEnvFile } from "../../utils/general";

loadEnvFile();

/* Initialize the OpenAI client */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const agent = await Agent.createFromEnv({});

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;
  const senderAddress = await ctx.getSenderAddress();
  console.log(`Received message: ${messageContent} by ${senderAddress}`);

  try {
    /* Get the AI response */
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: messageContent }],
      model: "gpt-5-nano",
    });

    /* Get the AI response */
    const response =
      completion.choices[0]?.message?.content ||
      "I'm not sure how to respond to that.";

    console.log(`Sending AI response: ${response}`);
    /* Send the AI response to the conversation */
    await ctx.sendText(response);
  } catch (error) {
    console.error("Error getting AI response:", error);
    await ctx.sendText(
      "Sorry, I encountered an error processing your message.",
    );
  }
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${getTestUrl(agent.client)}`);
});

void agent.start();
