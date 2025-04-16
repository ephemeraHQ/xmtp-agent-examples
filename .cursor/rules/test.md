# Using test-cli to confirm an agent is running

Once you see the "Waiting for messages..." message, the agent is fully initialized and ready to receive messages. At this point:

In a separate terminal window, use the test-cli to send test messages to your agent:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Send a message to your agent
# Make sure to use the public key from your agent's .env file
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Test message"
```

> Note: `test-cli` uses default keys for testing, so it doesn't require an .env file to run. It has built-in defaults for WALLET_KEY and ENCRYPTION_KEY.

Expected output:

```
Sending message to 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f: "Test message"
Connected as: 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Inbox ID: f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751
Creating conversation with 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f...
Sending message...
Message sent successfully!
```

## Example: testing a number multiplier agent

```bash
# Terminal 1: Start the agent
cd examples/xmtp-number-multiplier
yarn dev

# Terminal 2: Send test messages
cd examples/xmtp-number-multiplier
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "99.5"
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Hello agent"
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "-25"
yarn test-cli 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "1.5e3"
```

Terminal 1 output:

```
Received message: 99.5
Multiplied 99.5 by 2: 199
Creating group "Multiplier result for 99.5" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for 99.5" created successfully and result sent

Received message: Hello agent

Received message: -25
Multiplied -25 by 2: -50
Creating group "Multiplier result for -25" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for -25" created successfully and result sent

Received message: 1.5e3
Multiplied 1500 by 2: 3000
Creating group "Multiplier result for 1500" with sender f9f50f49317a4262666a80e582bf3737c91b59ebd3338c0feb128b7cc434d751...
Group "Multiplier result for 1500" created successfully and result sent
```
