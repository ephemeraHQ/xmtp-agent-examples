# Mini-app standalone example

> [!IMPORTANT]
> This implementation lives in another repository: https://github.com/ephemeraHQ/xmtp-mini-app-example

This combines a backend agent and a frontend mini app to resolve mentions in a group chat.

<p align="center" >
  <img src="media/left.png" alt="Image 1" width="49%">
  <img src="media/right.png" alt="Image 2" width="49%">
</p>

## Usage

1. Send a message in a group chat to the agent tagging other users.

```bash
hey @game, lets challenge @vitalik.eth @humanagent.eth and @0x...
```

2. The agent will respond with a mini app link to the frontend.

```bash
http://mini-app-example.ngrok.io?tags=vitalik.eth,humanagent.eth,0x...
```

3. The frontend will resolve the mentions and display the user profiles.

```bash
✅ vitalik.eth → 0x...
✅ humanagent.eth → 0x...
✅ 0x... → 0x...
```

> This example uses the Neynar API to resolve [Farcaster usernames to Ethereum addresses](https://docs.neynar.com/reference/fetch-bulk-users).
