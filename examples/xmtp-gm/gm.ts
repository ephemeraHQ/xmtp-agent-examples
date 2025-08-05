import { Agent } from "./Agent";
import { getClient } from "./getClient";

(async () => {
  const client = await getClient();
  const agent = new Agent({ client });

  agent.use(async (_, next) => {
    console.log("🔵 Before processing message...");
    await next();
  });

  agent.on("message", async (ctx) => {
    ctx.conversation.send("gm! 🌅");
  });

  await agent.start();
})();
