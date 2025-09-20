> 🚀 **Now with the latest XMTP Agent SDK!** These examples have been updated to use the newest version of the [XMTP Agent SDK](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk). Want to go back to legacy? try out the [node-sdk branch](https://github.com/ephemeraHQ/xmtp-agent-examples/tree/node-sdk).

# XMTP agent examples

These example agents serve as a starting point for building your own agents. They are built with the [XMTP Agent SDK](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk) and run on the [XMTP](https://docs.xmtp.org/) network.

- [xmtp-gm](/examples/xmtp-gm/): A simple agent that replies to all text messages with "gm"
- [xmtp-gpt](/examples/xmtp-gpt/): An example using GPT API's to answer messages
- [xmtp-gated-group](/examples/xmtp-gated-group/): Add members to a group based on arbitrary criteria
- [xmtp-coinbase-agentkit](/examples/xmtp-coinbase-agentkit/): Agent that uses a CDP for gasless USDC on base
- [xmtp-transactions](/examples/xmtp-transactions/): Allow transactions between users and agents
- [xmtp-gaia](/examples/xmtp-gaia/): Agent that uses a CDP for gasless USDC on base
- [xmtp-smart-wallet](/examples/xmtp-smart-wallet/): Agent that uses a smart wallet to send messages
- [xmtp-attachments](/examples/xmtp-attachments/): Agent that sends and receives images
- [xmtp-inline-actions](/examples/xmtp-inline-actions/): An example using inline actions (dynamic buttons)
- [xmtp-thinking-reaction](/examples/xmtp-thinking-reaction/): Agent that reacts to messages with a thinking emoji
- [xmtp-queue-dual-client](/examples/xmtp-queue-dual-client/): Agent that uses two clients to send and receive messages
- [xmtp-welcome-message](/examples/xmtp-welcome-message/): Agent that sends a welcome message when its added and to new members

### Vibe coding

See these [Cursor rules](/.cursor) for vibe coding agents with XMTP using best practices.

```bash
Prompt: lets create an example that gets a number and returns its 2x multiple (use claude max)
```

🎥 Watch [Vibe coding secure agents with XMTP](https://youtu.be/djRLnWUvwIA) for a quickstart guide to building with these example agents.

### Run an example agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

### Set environment variables

To run an example XMTP agent, you must create a `.env` file with the following variables:

```bash
XMTP_WALLET_KEY= # the private key of the wallet
XMTP_DB_ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

### Generate random XMTP keys

Use this script to generate random XMTP keys:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

### Revoke installations

You can revoke old installations by running:

```bash
# you can get your values from terminal logs
yarn revoke <inbox-id> <installations-to-exclude>
```

### Enable debug mode

You can enable debug mode by adding the following to your `.env` file:

```bash
XMTP_FORCE_DEBUG=true
```

> This will print additional information to the console.

### Talk to your agent

Try out the example agents using [xmtp.chat](https://xmtp.chat), the official playground for agents.

![](/examples/xmtp-gm/screenshot.png)

### Run a local XMTP network (Optional)

`dev` and `production` networks are hosted by XMTP, while you can run your own `local` network.

1. Install Docker

2. Start the XMTP service and database

   ```bash
   ./dev/up
   ```

3. Change the `.env` file to use the `local` network

   ```bash
   XMTP_ENV = local
   ```

### Deploy your own agent

See how to build and deploy [your own production-grade agent](https://docs.xmtp.org/agents/deploy-agent) with XMTP.
