# GM agent

This agent replies `gm`

![](./screenshot.png)

## Getting started

> [!NOTE]
> See our [Cursor Rules](/.cursor/README.md) for XMTP Agent development standards and best practices.

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
# install packages
yarn
# generate random xmtp keys (optional)
yarn gen:keys
# run the example
yarn dev
```

## Try it out

> Try XMTP using [xmtp.chat](https://xmtp.chat) and sending a message to `gm.xmtp.eth`

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/UCyz5b)
