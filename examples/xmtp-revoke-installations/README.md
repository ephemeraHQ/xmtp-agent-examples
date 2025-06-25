# Revoking installations

An installation in XMTP refers to a unique instance of an app (like on a device ) that accesses a user’s inbox. Each installation gets its own ID and is tracked separately, allowing users to manage which devices have access to their messages. Starting with node `2.2.0`, XMTP enforces a strict limit of `5` active installations per inbox. This is crucial to prevent excessive group sizes and avoid hitting the 256 inbox update limit, which would force users to rotate their inbox and lose existing conversations.

Keeping the local database across runs ensures the client can reuse the same inbox ID and avoid unnecessary creation of new installations, helping users stay within the 5-installation cap and maintain seamless access to their messages.

> See how to keep the DB across runs in [Railway](https://github.com/ephemeraHQ/xmtp-agent-examples/discussions/77) volumes.

> [!WARNING]
> **Message Loss Risk**: Revoking an installation permanently deletes messages only accessible from that device.

## Getting started

> [!TIP]
> See XMTP's [cursor rules](/.cursor/README.md) for vibe coding agents and best practices.

### Requirements

- Node.js v20 or higher
- Yarn v4 or higher
- Docker (optional, for local network)

### Environment variables

To run your XMTP agent, you must create a `.env` file with the following variables:

```bash
WALLET_KEY= # the private key of the wallet
ENCRYPTION_KEY= # encryption key for the local database
XMTP_ENV=dev # local, dev, production
```

You can generate random xmtp keys with the following command:

```bash
yarn gen:keys
```

> [!WARNING]
> Running the `gen:keys` command will append keys to your existing `.env` file.

### Run the agent

```bash
# git clone repo
git clone https://github.com/ephemeraHQ/xmtp-agent-examples.git
# go to the folder
cd xmtp-agent-examples
cd examples/xmtp-gm
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```
