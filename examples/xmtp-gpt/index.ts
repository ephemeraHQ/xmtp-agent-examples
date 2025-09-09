import fs from "fs";
import { Agent } from "@xmtp/agent-sdk";
import OpenAI from "openai";

process.loadEnvFile(".env");

const getDbPath = (description = "xmtp") => {
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
  if (!fs.existsSync(volumePath)) fs.mkdirSync(volumePath, { recursive: true });
  return `${volumePath}/${description}.db3`;
};

/* Initialize the OpenAI client */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const agent = await Agent.createFromEnv({
  dbPath: getDbPath(),
});

agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;

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
