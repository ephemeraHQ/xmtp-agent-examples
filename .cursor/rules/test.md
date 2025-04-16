# Testing XMTP agents

When developing and testing XMTP agents, it's important to capture logs for debugging and verification. This guide shows how to properly test agents using the test-cli tool.

## Running agents with logfiles

Always run agents with output redirected to a logfile for better debugging:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Run the agent with output redirected to a logfile
yarn dev > agent.log 2>&1 &
echo $! > agent.pid

# To stop the agent later
kill $(cat agent.pid)
```

## Using test-cli to send messages

In a separate terminal window, use the test-cli to send test messages to your agent:

```bash
# Navigate to your agent directory
cd examples/your-agent-name

# Send a message to your agent
# Make sure to use the public key from your agent's .env file
# Usage: yarn test-cli <network> <target_address> <message>
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Test message"
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

## Checking agent response in logfile

To verify the agent is working correctly, check the logfile:

```bash
# View the entire log
cat agent.log

# Follow new log entries in real-time
tail -f agent.log
```

## Example: testing a number multiplier agent

```bash
# Terminal 1: Start the agent with logging
cd examples/xmtp-number-multiplier
yarn dev > agent.log 2>&1 &
echo $! > agent.pid

# Terminal 2: Send test messages
cd examples/xmtp-number-multiplier
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "99.5"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "Hello agent"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "-25"
yarn test-cli dev 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f "1.5e3"

# Check the logs to verify agent behavior
cat agent.log

# When done, stop the agent
kill $(cat agent.pid)
```

Example agent.log content:

```
    ██╗  ██╗███╗   ███╗████████╗██████╗
    ╚██╗██╔╝████╗ ████║╚══██╔══╝██╔══██╗
     ╚███╔╝ ██╔████╔██║   ██║   ██████╔╝
     ██╔██╗ ██║╚██╔╝██║   ██║   ██╔═══╝
    ██╔╝ ██╗██║ ╚═╝ ██║   ██║   ██║
    ╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝   ╚═╝

╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                         Agent Details                                        ║
╟──────────────────────────────────────────────────────────────────────────────────────────────╢
║ 📍 Address: 0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f                                       ║
║ 📍 inboxId: a0974e5184a37d293b9825bbc7138897ffe457768b9b6ae6fe1f70ead1455da7                 ║
║ 📂 DB Path: ../xmtp-number-multiplier/xmtp-dev-0x41592a3a39ef582fa38c4062e8a3a23102f7f05f.db3║
║ 🛜  Network: dev                                                                              ║
║ 🔗 URL: http://xmtp.chat/dm/0x41592A3A39Ef582Fa38C4062e8A3A23102f7F05f?env=dev               ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
✓ Syncing conversations...
Waiting for messages...
Received number: 99.5, multiplied result: 199
Creating group with sender 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Group created and message sent successfully
Received non-number message: Hello agent
Received number: -25, multiplied result: -50
Creating group with sender 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Group created and message sent successfully
Received number: 1500, multiplied result: 3000
Creating group with sender 0x94dafa657d01247ff6094567eb54bdd2baf16c10
Group created and message sent successfully
```

## Troubleshooting

If you don't see agent responses in the log, check:

1. Is the agent running? `ps -ef | grep tsx`
2. Are there any errors in the logfile? `grep -i error agent.log`
3. Try restarting the agent
4. Ensure your agent address is correct when using test-cli
