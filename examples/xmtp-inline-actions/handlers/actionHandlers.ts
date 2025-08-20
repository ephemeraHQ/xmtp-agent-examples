import type { Conversation } from "@xmtp/node-sdk";
import {
  ContentTypeActions,
  type ActionsContent,
} from "../types/ActionsContent";
import type { TokenHandler } from "./tokenHandler";

export async function handleActionsCommand(
  conversation: Conversation,
  _tokenHandler: TokenHandler,
) {
  const actionsContent: ActionsContent = {
    id: `help-${Date.now()}`,
    description: "Glad to help you out! Here are some actions you can take:",
    actions: [
      {
        id: "send-small",
        label: "Send 0.005 USDC",
        style: "primary",
      },
      {
        id: "send-large",
        label: "Send 1 usdc",
        style: "primary",
      },
      {
        id: "check-balance",
        label: "Check balance",
        style: "primary",
      },
    ],
  };

  console.log("🎯 Sending inline actions help message");
  await conversation.send(actionsContent, ContentTypeActions);
}

export async function handleActionsWithImagesCommand(
  conversation: Conversation,
  _tokenHandler: TokenHandler,
) {
  const actionsContent: ActionsContent = {
    id: `help-${Date.now()}`,
    description:
      "Glad to help you out! Here are some actions you can take with images:",
    actions: [
      {
        id: "send-small",
        label: "Send 0.005 USDC",
        style: "primary",
        imageUrl: "https://cataas.com/cat",
      },
      {
        id: "send-large",
        label: "Send 1 usdc",
        style: "primary",
        imageUrl: "https://cataas.com/cat",
      },
      {
        id: "check-balance",
        label: "Check balance",
        style: "primary",
        imageUrl: "https://cataas.com/cat",
      },
    ],
  };

  console.log("🎯 Sending inline actions help message");
  await conversation.send(actionsContent, ContentTypeActions);
}

export async function handleHelpCommand(
  conversation: Conversation,
  _tokenHandler: TokenHandler,
) {
  const networkInfo = _tokenHandler.getNetworkInfo();

  const helpContent: ActionsContent = {
    id: `help-${Date.now()}`,
    description: `👋 Welcome to TBA Chat Example Bot!

I'm here to help you interact with ${networkInfo.name} blockchain. I can help you send tokens, check balances, and more!

✨ Choose an action below to get started:`,
    actions: [
      {
        id: "show-actions",
        label: "🚀 Show me actions",
        style: "primary",
      },
      {
        id: "show-actions-with-images",
        label: "🖼️ Show me actions with images",
        style: "primary",
      },
      {
        id: "transaction-with-metadata",
        label: "😉 Transaction with metadata",
        style: "primary",
      },
      {
        id: "transact-with-paymaster",
        label: "💳 Paymaster + Metadata",
        style: "primary",
      },
      {
        id: "check-balance",
        label: "💰 Check balance",
        style: "primary",
      },
      {
        id: "more-info",
        label: "ℹ️ More info",
        style: "secondary",
      },
    ],
  };

  console.log("🆘 Sending help message with welcome actions");
  await conversation.send(helpContent, ContentTypeActions);
}
