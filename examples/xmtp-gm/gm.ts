import { Agent } from "./Agent";
import { getClient } from "./getClient";

(async () => {
  const client = await getClient();
  const agent = new Agent({ client });
  agent.on("message", async (ctx) => {
    if (ctx.isDM()) {
      const senderAddress = await ctx.getSenderAddress();
      console.log(`Sending "gm" response to ${senderAddress}...`);
      await ctx.send("gm! 🌅");
    }
  });
  await agent.start();
})();
