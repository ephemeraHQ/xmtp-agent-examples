import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { GameManager } from "./game";

/**
 * Entry point for command processing
 * @param content - The message content from the user
 * @param userId - The user's identifier
 * @param gameManager - The game manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
export async function handleCommand(
  content: string,
  userId: string,
  gameManager: GameManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: { configurable: { thread_id: string } },
): Promise<string> {
  const commandParts = content.split(" ");
  const firstWord = commandParts[0].toLowerCase();

  // Check if the first word is a command
  if (
    ["create", "join", "execute", "status", "list", "balance", "help"].includes(
      firstWord,
    )
  ) {
    // Handle traditional command formatting
    const [command, ...args] = commandParts;
    return handleExplicitCommand(command, args, userId, gameManager);
  } else {
    // This is likely a natural language prompt
    return handleNaturalLanguageCommand(
      content,
      userId,
      gameManager,
      agent,
      agentConfig,
    );
  }
}

/**
 * Handle explicit commands like create, join, execute, etc.
 * @param command - The command type
 * @param args - The command arguments
 * @param userId - The user's identifier
 * @param gameManager - The game manager instance
 * @returns Response message to send back to the user
 */
async function handleExplicitCommand(
  command: string,
  args: string[],
  userId: string,
  gameManager: GameManager,
): Promise<string> {
  switch (command.toLowerCase()) {
    case "create": {
      const amount = args[0];
      if (!amount) {
        return "Please specify a toss amount: create <amount>";
      }

      // Check if user has sufficient balance
      const balance = await gameManager.getUserBalance(userId);
      if (balance < parseFloat(amount)) {
        return `Insufficient USDC balance. You need at least ${amount} USDC to create a toss. Your balance: ${balance} USDC`;
      }

      // Create the toss - creator doesn't join automatically now
      const toss = await gameManager.createGame(userId, amount);

      // Generate response with toss options if they exist
      let optionsMessage = "";
      if (toss.tossOptions && toss.tossOptions.length > 0) {
        optionsMessage = `\nOptions: ${toss.tossOptions.join(", ")}\n\nYou need to join your own toss by choosing an option: join ${toss.id} <option>`;
      } else {
        optionsMessage = `\n\nYou need to join your own toss first: join ${toss.id} yes/no`;
      }

      return `Toss created!\nToss ID: ${toss.id}\nToss Amount: ${toss.tossAmount} USDC${
        toss.tossTopic ? `\nTopic: ${toss.tossTopic}` : ""
      }${optionsMessage}\n\nOther players can join with: join ${toss.id} <option>\nWhen everyone has joined, you can run: execute ${toss.id}`;
    }

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

      // First check if the toss exists and is joinable
      const toss = await gameManager.joinGame(tossId, userId);

      // Check if an option was provided
      if (!chosenOption) {
        const availableOptions =
          toss.tossOptions && toss.tossOptions.length > 0
            ? toss.tossOptions.join(", ")
            : "yes, no";

        return `Please specify your option when joining: join ${tossId} <option>\nAvailable options: ${availableOptions}`;
      }

      // Check user's balance
      const balance = await gameManager.getUserBalance(userId);
      if (balance < parseFloat(toss.tossAmount)) {
        return `Insufficient USDC balance. You need ${toss.tossAmount} USDC to join this toss. Your balance: ${balance} USDC`;
      }

      // Make the payment
      const paymentSuccess = await gameManager.makePayment(
        userId,
        tossId,
        toss.tossAmount,
        chosenOption,
      );

      if (!paymentSuccess) {
        return `Payment failed. Please ensure you have enough USDC and try again.`;
      }

      // Add player to toss after payment
      const updatedToss = await gameManager.addPlayerToGame(
        tossId,
        userId,
        chosenOption,
        true,
      );

      // Generate player ID (P2, P3, etc. based on position)
      const playerPosition =
        updatedToss.participants.findIndex((p) => p === userId) + 1;
      const playerId = `P${playerPosition}`;

      // Include toss topic and options in the response if available
      let responseMessage = `Successfully joined toss ${tossId}! Payment of ${toss.tossAmount} USDC sent.\nYour Player ID: ${playerId}\nYour Choice: ${chosenOption}\nTotal players: ${updatedToss.participants.length}`;

      if (updatedToss.tossTopic) {
        responseMessage += `\nToss Topic: "${updatedToss.tossTopic}"`;

        if (updatedToss.tossOptions && updatedToss.tossOptions.length === 2) {
          responseMessage += `\nOptions: ${updatedToss.tossOptions[0]} or ${updatedToss.tossOptions[1]}`;
        }
      }

      if (userId === toss.creator) {
        responseMessage += `\n\nAs the creator, you can execute the toss with: execute ${tossId}`;
      } else {
        responseMessage += `\n\nWaiting for the toss creator to execute the toss.`;
      }

      return responseMessage;
    }

    case "execute": {
      const tossId = args[0];
      if (!tossId) {
        return "Please specify a toss ID: execute <tossId>";
      }

      // Check if the user is the creator
      const toss = await gameManager.getGame(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      if (toss.creator !== userId) {
        return "Only the toss creator can execute the toss.";
      }

      if (toss.participants.length < 2) {
        return "At least 2 players are needed to execute the toss.";
      }

      let result;
      try {
        result = await gameManager.executeCoinToss(tossId);

        // Check if the toss was successful and a winner was determined
        if (!result.winner) {
          return "The toss failed to determine a winner. Please try again.";
        }
      } catch (error) {
        console.error("Error executing toss:", error);
        return `Error executing toss: ${error instanceof Error ? error.message : "Unknown error"}`;
      }

      // Generate player IDs for result message
      const playerMap = await Promise.all(
        result.participants.map(async (player, index) => {
          const walletAddress =
            (await gameManager.getPlayerWalletAddress(player)) || player;
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
          result.participantOptions.find((opt) => opt.userId === p.address)
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

      const toss = await gameManager.getGame(tossId);
      if (!toss) {
        return `Toss ${tossId} not found.`;
      }

      // Generate player IDs for status message with wallet addresses
      const playerMap = await Promise.all(
        toss.participants.map(async (player, index) => {
          const walletAddress =
            (await gameManager.getPlayerWalletAddress(player)) || player;
          return {
            id: `P${index + 1}${player === toss.creator ? " (Creator)" : ""}`,
            address: player,
            walletAddress: walletAddress,
          };
        }),
      );

      let statusMessage = `🎮 TOSS #${tossId} STATUS 🎮\n\n`;

      // Add toss topic if available
      if (toss.tossTopic) {
        statusMessage += `📝 Toss: "${toss.tossTopic}"\n`;

        if (toss.tossOptions && toss.tossOptions.length === 2) {
          statusMessage += `🎯 Options: ${toss.tossOptions[0]} or ${toss.tossOptions[1]}\n\n`;
        }
      }

      statusMessage += `Status: ${toss.status}\n`;
      statusMessage += `Toss Amount: ${toss.tossAmount} USDC\n`;
      statusMessage += `Prize Pool: ${parseFloat(toss.tossAmount) * toss.participants.length} USDC\n`;

      // Show creator's wallet address
      const creatorWallet =
        (await gameManager.getPlayerWalletAddress(toss.creator)) ||
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
            toss.participantOptions.find((opt) => opt.userId === p.address)
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
            (await gameManager.getPlayerWalletAddress(toss.winner)) ||
            toss.winner;
          statusMessage += `\nWinner: ${winnerId} (${winnerWallet.substring(0, 10)}...${winnerWallet.substring(winnerWallet.length - 6)})\n`;
        }
      }

      return statusMessage;
    }

    case "list": {
      const tosses = await gameManager.listActiveGames();
      if (tosses.length === 0) {
        return "No active tosses found.";
      }

      // Updated toss descriptions with wallet addresses
      const tossDescriptions = await Promise.all(
        tosses.map(async (toss) => {
          const creatorWallet =
            (await gameManager.getPlayerWalletAddress(toss.creator)) ||
            toss.creator;
          const shortCreatorWallet =
            creatorWallet.substring(0, 10) +
            "..." +
            creatorWallet.substring(creatorWallet.length - 6);

          return `Toss ID: ${toss.id}\nToss Amount: ${toss.tossAmount} USDC\nStatus: ${toss.status}\nPlayers: ${toss.participants.length}\nCreator: ${shortCreatorWallet}\nToss Wallet: ${toss.walletAddress}`;
        }),
      );

      return tossDescriptions.join("\n\n");
    }

    case "balance": {
      const balance = await gameManager.getUserBalance(userId);
      const walletAddress = await gameManager.getPlayerWalletAddress(userId);
      return `Your USDC balance: ${balance}\nYour wallet address: ${walletAddress}`;
    }

    case "help":
      return `Available commands:
create <amount> - Create a new toss with specified USDC amount
join <tossId> <option> - Join an existing toss with the specified ID and your chosen option
execute <tossId> - Execute the toss resolution (only for toss creator)
status <tossId> - Check the status of a specific toss
list - List all active tosses
balance - Check your wallet balance and address
help - Show this help message

You can also create a toss using natural language, for example:
"Will it rain tomorrow for 5" - Creates a yes/no toss with 5 USDC
"Lakers vs Celtics for 10" - Creates a toss with Lakers and Celtics as options with 10 USDC`;

    default:
      return "Unknown command. Type help to see available commands.";
  }
}

/**
 * Handle natural language toss commands
 * @param prompt - The natural language prompt
 * @param userId - The user's identifier
 * @param gameManager - The game manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
async function handleNaturalLanguageCommand(
  prompt: string,
  userId: string,
  gameManager: GameManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: { configurable: { thread_id: string } },
): Promise<string> {
  try {
    console.log(`🧠 Processing natural language prompt: "${prompt}"`);

    // Check if user has sufficient balance (default check for minimum amount)
    const balance = await gameManager.getUserBalance(userId);
    if (balance < 0.01) {
      return `Insufficient USDC balance. You need at least 0.01 USDC to create a toss. Your balance: ${balance} USDC`;
    }

    // Create a toss using the natural language prompt
    const toss = await gameManager.createGameFromPrompt(
      userId,
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
    response += `You need to join your own toss first by choosing an option: join ${toss.id} <option>\n\n`;
    response += `Other players can join with: join ${toss.id} <option>\n`;
    response += `When everyone has joined, you can execute the toss with: execute ${toss.id}`;

    return response;
  } catch (error) {
    console.error("Error processing natural language command:", error);
    return `Sorry, I couldn't process your natural language toss. Please try again with a different wording or use explicit commands.

Example: "Will the price of Bitcoin reach $100k this year for 5"
Or use: create <amount> - to create a standard toss`;
  }
}
