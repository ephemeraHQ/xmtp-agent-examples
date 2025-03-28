import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { TossManager } from "./toss";
import { HELP_MESSAGE, type AgentConfig } from "./types";

/**
 * Entry point for command processing
 * @param content - The message content from the user
 * @param inboxId - The user's identifier
 * @param tossManager - The toss manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
export async function handleCommand(
  content: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  try {
    const commandParts = content.split(" ");
    const firstWord = commandParts[0].toLowerCase();

    // Check if the first word is a command
    if (
      ["join", "close", "status", "list", "balance", "help"].includes(firstWord)
    ) {
      // Handle traditional command formatting
      const [command, ...args] = commandParts;
      return await handleExplicitCommand(command, args, inboxId, tossManager);
    } else {
      // This is likely a natural language prompt
      return await handleNaturalLanguageCommand(
        content,
        inboxId,
        tossManager,
        agent,
        agentConfig,
      );
    }
  } catch (error) {
    console.error("Error handling natural language command:", error);
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Handle explicit commands like create, join, close, etc.
 * @param command - The command type
 * @param args - The command arguments
 * @param inboxId - The user's identifier
 * @param tossManager - The toss manager instance
 * @returns Response message to send back to the user
 */
async function handleExplicitCommand(
  command: string,
  args: string[],
  inboxId: string,
  tossManager: TossManager,
): Promise<string> {
  switch (command.toLowerCase()) {
    case "join": {
      // Check if we have enough arguments
      if (args.length < 1) {
        return "Please specify a toss ID and your chosen option: join <tossId> <option>";
      }

      const tossId = args[0];
      const chosenOption = args.length >= 2 ? args[1] : null;

      if (!tossId) {
        return "Please specify a toss ID: join <tossId> <option>";
      }

      // First check if the toss exists
      const toss = await tossManager.getToss(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      // Join the game
      const joinedToss = await tossManager.joinGame(tossId, inboxId);

      // Check if an option was provided
      if (!chosenOption) {
        const availableOptions =
          joinedToss.tossOptions && joinedToss.tossOptions.length > 0
            ? joinedToss.tossOptions.join(", ")
            : "yes, no";

        return `Please specify your option when joining: join ${tossId} <option>\nAvailable options: ${availableOptions}`;
      }

      // Validate the chosen option before making payment
      if (
        joinedToss.tossOptions &&
        !joinedToss.tossOptions.some(
          (option) => option.toLowerCase() === chosenOption.toLowerCase(),
        )
      ) {
        return `Invalid option: ${chosenOption}. Available options: ${joinedToss.tossOptions.join(", ")}`;
      }

      // Check user's balance
      const { balance } = await tossManager.getBalance(inboxId);
      if (balance < parseFloat(toss.tossAmount)) {
        return `Insufficient USDC balance. You need ${toss.tossAmount} USDC to join this toss. Your balance: ${balance} USDC`;
      }

      // Make the payment
      const paymentSuccess = await tossManager.makePayment(
        inboxId,
        tossId,
        toss.tossAmount,
        chosenOption,
      );

      if (!paymentSuccess) {
        return `Payment failed. Please ensure you have enough USDC and try again.`;
      }

      // Add player to toss after payment is confirmed
      const updatedToss = await tossManager.addPlayerToGame(
        tossId,
        inboxId,
        chosenOption,
        true,
      );

      // Generate player ID (P2, P3, etc. based on position)
      const playerPosition =
        updatedToss.participants.findIndex((p) => p === inboxId) + 1;
      const playerId = `P${playerPosition}`;

      // Include toss topic and options in the response if available
      let responseMessage = `Successfully joined toss ${tossId}! Payment of ${toss.tossAmount} USDC sent.\nYour Player ID: ${playerId}\nYour Choice: ${chosenOption}\nTotal players: ${updatedToss.participants.length}`;

      if (updatedToss.tossTopic) {
        responseMessage += `\nToss Topic: "${updatedToss.tossTopic}"`;

        if (updatedToss.tossOptions && updatedToss.tossOptions.length === 2) {
          responseMessage += `\nOptions: ${updatedToss.tossOptions[0]} or ${updatedToss.tossOptions[1]}`;
        }
      }

      if (inboxId === toss.creator) {
        responseMessage += `\n\nAs the creator, you can close the toss with: close ${tossId} <option>`;
      } else {
        responseMessage += `\n\nWaiting for the toss creator to close the toss.`;
      }

      return responseMessage;
    }

    case "close": {
      const tossId = args[0];
      const winningOption = args[1];

      if (!tossId) {
        return "Please specify a toss ID: close <tossId> <option>";
      }

      if (!winningOption) {
        return "Please specify the winning option: close <tossId> <option>";
      }

      // Check if the user is the creator
      const toss = await tossManager.getToss(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      if (inboxId !== toss.creator) {
        return "Only the toss creator can close the toss.";
      }

      if (toss.participants.length < 2) {
        return "At least 2 players are needed to close the toss.";
      }

      const balance = await tossManager.getBalance(toss.id);
      if (balance.balance < parseFloat(toss.tossAmount)) {
        return `Insufficient TOSS balance. You need ${toss.tossAmount} TOSS to close this toss. Your balance: ${balance.balance} TOSS`;
      }

      // Validate winning option
      if (
        toss.tossOptions &&
        !toss.tossOptions.some(
          (option) => option.toLowerCase() === winningOption.toLowerCase(),
        )
      ) {
        return `Invalid option. Please choose one of: ${toss.tossOptions.join(", ")}`;
      }

      let result;
      try {
        result = await tossManager.executeCoinToss(tossId, winningOption);

        // Check if the toss was successful and a winner was determined
        if (!result.winner) {
          return "The toss failed to determine a winner. Please try again.";
        }
      } catch (error) {
        console.error("Error closing toss:", error);
        return `Error closing toss: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      // Generate player IDs for result message
      const playerMap = await Promise.all(
        result.participants.map(async (player, index) => {
          const walletAddress =
            (await tossManager.getPlayerWalletAddress(player)) || player;
          return {
            id: `P${index + 1}${player === result.creator ? " (Creator)" : ""}`,
            address: player,
            walletAddress: walletAddress,
          };
        }),
      );

      // Create detailed result message
      let resultMessage = `🎲 TOSS RESULTS FOR TOSS #${tossId} 🎲\n\n`;

      // Add toss topic if available
      if (result.tossTopic) {
        resultMessage += `📝 Toss: "${result.tossTopic}"\n`;

        if (result.tossOptions && result.tossOptions.length === 2) {
          resultMessage += `🎯 Options: ${result.tossOptions[0]} or ${result.tossOptions[1]}\n\n`;
        }
      }

      resultMessage += `Players (${result.participants.length}):\n`;

      // List all players with their chosen options
      playerMap.forEach((p) => {
        const displayAddress =
          p.walletAddress.substring(0, 10) +
          "..." +
          p.walletAddress.substring(p.walletAddress.length - 6);
        const playerOption =
          result.participantOptions.find((opt) => opt.inboxId === p.address)
            ?.option || "Unknown";
        resultMessage += `${p.id}: ${displayAddress} (Chose: ${playerOption})\n`;
      });

      // Calculate total pot
      const totalPot =
        parseFloat(result.tossAmount) * result.participants.length;
      resultMessage += `\n💰 Total Pot: ${totalPot} USDC\n`;

      // Show the winning option (former toss result)
      resultMessage += `🎯 Winning Option: ${result.tossResult || "Unknown"}\n\n`;

      // Multiple winners handling - identify all players who chose the winning option
      const winnerIds = result.winner ? result.winner.split(",") : [];
      const winningPlayers = playerMap.filter((p) =>
        winnerIds.includes(p.address),
      );

      if (winningPlayers.length > 0) {
        // Calculate prize per winner
        const prizePerWinner = totalPot / winningPlayers.length;

        resultMessage += `🏆 WINNERS (${winningPlayers.length}):\n`;
        winningPlayers.forEach((winner) => {
          const displayAddress =
            winner.walletAddress.substring(0, 10) +
            "..." +
            winner.walletAddress.substring(winner.walletAddress.length - 6);
          resultMessage += `${winner.id}: ${displayAddress}\n`;
        });

        resultMessage += `\n💸 Prize per winner: ${prizePerWinner.toFixed(6)} USDC\n\n`;
      } else {
        resultMessage += "No winners found.\n\n";
      }

      if (result.paymentSuccess) {
        resultMessage += `✅ Winnings have been transferred to the winners' wallets.`;

        // Add transaction link if available
        if (result.transactionLink) {
          resultMessage += `\n🔗 Transaction: ${result.transactionLink}`;
        }
      } else {
        resultMessage += `⚠️ Automatic transfer of winnings failed. Please contact support.`;
      }

      return resultMessage;
    }

    case "status": {
      const tossId = args[0];
      if (!tossId) {
        return "Please specify a toss ID: status <tossId>";
      }

      const toss = await tossManager.getToss(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      // Generate player IDs for status message with wallet addresses
      const playerMap = await Promise.all(
        toss.participants.map(async (player, index) => {
          const walletAddress =
            (await tossManager.getPlayerWalletAddress(player)) || player;
          return {
            id: `P${index + 1}${player === toss.creator ? " (Creator)" : ""}`,
            address: player,
            walletAddress: walletAddress,
          };
        }),
      );

      let statusMessage = `TOSS #${tossId} 🪙\n\n`;

      // Add toss topic if available
      if (toss.tossTopic) {
        statusMessage += `📝 Toss: "${toss.tossTopic}"\n`;

        if (toss.tossOptions && toss.tossOptions.length === 2) {
          statusMessage += `🎯 Options: ${toss.tossOptions[0]} or ${toss.tossOptions[1]}\n\n`;
        }
      }

      const balance = await tossManager.getBalance(toss.id);
      statusMessage += `Status: ${toss.status}\n`;
      statusMessage += `Balance: ${balance.balance} USDC\n`;
      statusMessage += `Toss Amount: ${toss.tossAmount} USDC\n`;
      statusMessage += `Prize Pool: ${parseFloat(toss.tossAmount) * toss.participants.length} USDC\n`;

      // Show creator's wallet address
      const creatorWallet =
        (await tossManager.getPlayerWalletAddress(toss.creator)) ||
        toss.creator;
      const shortCreatorWallet =
        creatorWallet.substring(0, 10) +
        "..." +
        creatorWallet.substring(creatorWallet.length - 6);
      statusMessage += `Creator: ${shortCreatorWallet}\n`;

      statusMessage += `Toss Wallet: ${toss.walletAddress}\n`;
      statusMessage += `Created: ${new Date(toss.createdAt).toLocaleString()}\n\n`;

      statusMessage += `Players (${toss.participants.length}):\n`;

      if (toss.participants.length === 0) {
        statusMessage += "No players have joined yet.\n";
      } else {
        playerMap.forEach((p) => {
          const displayAddress =
            p.walletAddress.substring(0, 10) +
            "..." +
            p.walletAddress.substring(p.walletAddress.length - 6);
          const playerOption =
            toss.participantOptions.find((opt) => opt.inboxId === p.address)
              ?.option || "Unknown";
          statusMessage += `${p.id}: ${displayAddress} (Chose: ${playerOption})\n`;
        });
      }

      if (toss.winner) {
        // Check if we have multiple winners
        if (toss.winner.includes(",")) {
          const winnerIds = toss.winner.split(",");
          const winningPlayers = playerMap.filter((p) =>
            winnerIds.includes(p.address),
          );

          statusMessage += `\nWinning Option: ${toss.tossResult || "Unknown"}\n`;
          statusMessage += `Winners (${winningPlayers.length}):\n`;

          for (const winner of winningPlayers) {
            const displayAddress =
              winner.walletAddress.substring(0, 10) +
              "..." +
              winner.walletAddress.substring(winner.walletAddress.length - 6);
            statusMessage += `${winner.id}: ${displayAddress}\n`;
          }

          if (winningPlayers.length > 0) {
            const prizePerWinner =
              (parseFloat(toss.tossAmount) * toss.participants.length) /
              winningPlayers.length;
            statusMessage += `Prize per winner: ${prizePerWinner.toFixed(6)} USDC\n`;
          }
        } else {
          // Single winner (for backwards compatibility)
          const winnerInfo = playerMap.find((p) => p.address === toss.winner);
          const winnerId = winnerInfo ? winnerInfo.id : "Unknown";
          const winnerWallet =
            winnerInfo?.walletAddress ||
            (await tossManager.getPlayerWalletAddress(toss.winner)) ||
            toss.winner;
          statusMessage += `\nWinner: ${winnerId} (${winnerWallet.substring(0, 10)}...${winnerWallet.substring(winnerWallet.length - 6)})\n`;
        }
      }

      return statusMessage;
    }

    case "list": {
      const tosses = await tossManager.listActiveTosses();
      if (tosses.length === 0) {
        // Get the total count of tosses (including completed/cancelled) for debugging
        const allTossCount = await tossManager.getTotalTossCount();
        return `No active tosses found. (Total tosses in system: ${allTossCount})`;
      }

      // Updated toss descriptions with wallet addresses
      const tossDescriptions = await Promise.all(
        tosses.map(async (toss) => {
          const creatorWallet =
            (await tossManager.getPlayerWalletAddress(toss.creator)) ||
            toss.creator;
          const shortCreatorWallet =
            creatorWallet.substring(0, 10) +
            "..." +
            creatorWallet.substring(creatorWallet.length - 6);

          const balance = await tossManager.getBalance(toss.id);
          return `Toss ID: ${toss.id}\nToss Amount: ${toss.tossAmount} USDC\nBalance: ${balance.balance} USDC\nStatus: ${toss.status}\nPlayers: ${toss.participants.length}\nCreator: ${shortCreatorWallet}\nToss Wallet: ${toss.walletAddress}`;
        }),
      );

      return tossDescriptions.join("\n\n");
    }

    case "balance": {
      const { balance, address } = await tossManager.getBalance(inboxId);
      return `Your USDC balance: ${balance}\nYour wallet address: ${address}`;
    }

    case "help":
      return HELP_MESSAGE;

    default:
      return "Unknown command. Type help to see available commands.";
  }
}

/**
 * Handle natural language toss commands
 * @param prompt - The natural language prompt
 * @param inboxId - The user's identifier
 * @param tossManager - The toss manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
async function handleNaturalLanguageCommand(
  prompt: string,
  inboxId: string,
  tossManager: TossManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  console.log(`🧠 Processing natural language prompt: "${prompt}"`);

  // Check if user has sufficient balance (default check for minimum amount)
  const { balance, address } = await tossManager.getBalance(inboxId);
  if (balance < 0.01) {
    return `Insufficient USDC balance. You need at least 0.01 USDC to create a toss. Your balance: ${balance} USDC\nTransfer USDC to your wallet address: ${address}`;
  }

  // Create a toss using the natural language prompt
  const toss = await tossManager.createGameFromPrompt(
    inboxId,
    prompt,
    agent,
    agentConfig,
  );

  // Create a detailed response with the parsed information
  let response = `🎲 Toss Created! 🎲\n\n`;
  response += `Toss ID: ${toss.id}\n`;
  response += `Topic: "${toss.tossTopic}"\n`;

  if (toss.tossOptions && toss.tossOptions.length === 2) {
    response += `Options: ${toss.tossOptions[0]} or ${toss.tossOptions[1]}\n`;
  }

  response += `Toss Amount: ${toss.tossAmount} USDC\n\n`;
  response += `Other players can join with: join ${toss.id} <option>\n`;
  response += `When everyone has joined, you can close the toss with: close ${toss.id} <option>`;

  return response;
}
