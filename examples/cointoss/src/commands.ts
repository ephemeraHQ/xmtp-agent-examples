import type { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { GameManager } from "./toss";
import type { AgentConfig, XMTPUser } from "./types";

/**
 * Entry point for command processing
 * @param content - The message content from the user
 * @param inboxId - The user's identifier
 * @param humanAddress - The user's human address
 * @param gameManager - The game manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
export async function handleCommand(
  content: string,
  xmtpUser: XMTPUser,
  gameManager: GameManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
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
    return handleExplicitCommand(command, args, xmtpUser, gameManager);
  } else {
    // This is likely a natural language prompt
    return handleNaturalLanguageCommand(
      content,
      xmtpUser,
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
 * @param inboxId - The user's identifier
 * @param humanAddress - The user's human address
 * @param gameManager - The game manager instance
 * @returns Response message to send back to the user
 */
async function handleExplicitCommand(
  command: string,
  args: string[],
  xmtpUser: XMTPUser,
  gameManager: GameManager,
): Promise<string> {
  switch (command.toLowerCase()) {
    case "create": {
      const amount = args[0];
      if (!amount) {
        return "Please specify a toss amount: create <amount>";
      }

      // Check if user has sufficient balance
      const balance = await gameManager.getUserBalance(xmtpUser.address);
      if (balance < parseFloat(amount)) {
        return `Insufficient USDC balance. You need at least ${amount} USDC to create a game. Your balance: ${balance} USDC`;
      }

      // Create the game - creator doesn't join automatically now
      const game = await gameManager.createGame(xmtpUser.address, amount);

      // Generate response with toss options if they exist
      let optionsMessage = "";
      if (game.tossOptions && game.tossOptions.length > 0) {
        optionsMessage = `\nOptions: ${game.tossOptions.join(", ")}\n\nYou need to join your own game by choosing an option: join ${game.id} <option>`;
      } else {
        optionsMessage = `\n\nYou need to join your own game first: join ${game.id} yes/no`;
      }

      return `Game created!\nGame ID: ${game.id}\nToss Amount: ${game.tossAmount} USDC${
        game.tossTopic ? `\nTopic: ${game.tossTopic}` : ""
      }${optionsMessage}\n\nOther players can join with: join ${game.id} <option>\nWhen everyone has joined, you can run: execute ${game.id}`;
    }

    case "join": {
      // Check if we have enough arguments
      if (args.length < 1) {
        return "Please specify a game ID and your chosen option: join <gameId> <option>";
      }

      const gameId = args[0];
      const chosenOption = args.length >= 2 ? args[1] : null;

      if (!gameId) {
        return "Please specify a game ID: join <gameId> <option>";
      }

      // First check if the game exists and is joinable
      const game = await gameManager.joinGame(gameId, xmtpUser.address);

      // Check if an option was provided
      if (!chosenOption) {
        const availableOptions =
          game.tossOptions && game.tossOptions.length > 0
            ? game.tossOptions.join(", ")
            : "yes, no";

        return `Please specify your option when joining: join ${gameId} <option>\nAvailable options: ${availableOptions}`;
      }

      // Check user's balance
      const balance = await gameManager.getUserBalance(xmtpUser.address);
      if (balance < parseFloat(game.tossAmount)) {
        return `Insufficient USDC balance. You need ${game.tossAmount} USDC to join this game. Your balance: ${balance} USDC`;
      }

      // Make the payment
      const paymentSuccess = await gameManager.makePayment(
        xmtpUser,
        gameId,
        game.tossAmount,
        chosenOption,
      );

      if (!paymentSuccess) {
        return `Payment failed. Please ensure you have enough USDC and try again.`;
      }

      // Add player to game after payment
      const updatedGame = await gameManager.addPlayerToGame(
        gameId,
        xmtpUser.address,
        chosenOption,
        true,
      );

      // Generate player ID (P2, P3, etc. based on position)
      const playerPosition =
        updatedGame.participants.findIndex((p) => p === xmtpUser.address) + 1;
      const playerId = `P${playerPosition}`;

      // Include toss topic and options in the response if available
      let responseMessage = `Successfully joined game ${gameId}! Payment of ${game.tossAmount} USDC sent.\nYour Player ID: ${playerId}\nYour Choice: ${chosenOption}\nTotal players: ${updatedGame.participants.length}`;

      if (updatedGame.tossTopic) {
        responseMessage += `\nToss Topic: "${updatedGame.tossTopic}"`;

        if (updatedGame.tossOptions && updatedGame.tossOptions.length === 2) {
          responseMessage += `\nOptions: ${updatedGame.tossOptions[0]} or ${updatedGame.tossOptions[1]}`;
        }
      }

      if (xmtpUser.address === game.creator) {
        responseMessage += `\n\nAs the creator, you can execute the toss with: execute ${gameId}`;
      } else {
        responseMessage += `\n\nWaiting for the game creator to execute the toss.`;
      }

      return responseMessage;
    }

    case "execute": {
      const gameId = args[0];
      if (!gameId) {
        return "Please specify a game ID: execute <gameId>";
      }

      // Check if the user is the creator
      const game = await gameManager.getGame(gameId);
      if (!game) {
        return `Game ${gameId} not found.`;
      }

      if (game.creator !== xmtpUser.address) {
        return "Only the game creator can execute the toss.";
      }

      if (game.participants.length < 2) {
        return "At least 2 players are needed to execute the toss.";
      }

      let result;
      try {
        result = await gameManager.executeCoinToss(gameId);

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
      let resultMessage = `🎲 COIN TOSS RESULTS FOR GAME #${gameId} 🎲\n\n`;

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
      resultMessage += `🎯 Winning Option: ${result.coinTossResult || "Unknown"}\n\n`;

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
      const gameId = args[0];
      if (!gameId) {
        return "Please specify a game ID: status <gameId>";
      }

      const game = await gameManager.getGame(gameId);
      if (!game) {
        return `Game ${gameId} not found.`;
      }

      // Generate player IDs for status message with wallet addresses
      const playerMap = await Promise.all(
        game.participants.map(async (player, index) => {
          const walletAddress =
            (await gameManager.getPlayerWalletAddress(player)) || player;
          return {
            id: `P${index + 1}${player === game.creator ? " (Creator)" : ""}`,
            address: player,
            walletAddress: walletAddress,
          };
        }),
      );

      let statusMessage = `🎮 GAME #${gameId} STATUS 🎮\n\n`;

      // Add toss topic if available
      if (game.tossTopic) {
        statusMessage += `📝 Toss: "${game.tossTopic}"\n`;

        if (game.tossOptions && game.tossOptions.length === 2) {
          statusMessage += `🎯 Options: ${game.tossOptions[0]} or ${game.tossOptions[1]}\n\n`;
        }
      }

      statusMessage += `Status: ${game.status}\n`;
      statusMessage += `Toss Amount: ${game.tossAmount} USDC\n`;
      statusMessage += `Prize Pool: ${parseFloat(game.tossAmount) * game.participants.length} USDC\n`;

      // Show creator's wallet address
      const creatorWallet =
        (await gameManager.getPlayerWalletAddress(game.creator)) ||
        game.creator;
      const shortCreatorWallet =
        creatorWallet.substring(0, 10) +
        "..." +
        creatorWallet.substring(creatorWallet.length - 6);
      statusMessage += `Creator: ${shortCreatorWallet}\n`;

      statusMessage += `Game Wallet: ${game.walletAddress}\n`;
      statusMessage += `Created: ${new Date(game.createdAt).toLocaleString()}\n\n`;

      statusMessage += `Players (${game.participants.length}):\n`;

      if (game.participants.length === 0) {
        statusMessage += "No players have joined yet.\n";
      } else {
        playerMap.forEach((p) => {
          const displayAddress =
            p.walletAddress.substring(0, 10) +
            "..." +
            p.walletAddress.substring(p.walletAddress.length - 6);
          const playerOption =
            game.participantOptions.find((opt) => opt.userId === p.address)
              ?.option || "Unknown";
          statusMessage += `${p.id}: ${displayAddress} (Chose: ${playerOption})\n`;
        });
      }

      if (game.winner) {
        // Check if we have multiple winners
        if (game.winner.includes(",")) {
          const winnerIds = game.winner.split(",");
          const winningPlayers = playerMap.filter((p) =>
            winnerIds.includes(p.address),
          );

          statusMessage += `\nWinning Option: ${game.coinTossResult || "Unknown"}\n`;
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
              (parseFloat(game.tossAmount) * game.participants.length) /
              winningPlayers.length;
            statusMessage += `Prize per winner: ${prizePerWinner.toFixed(6)} USDC\n`;
          }
        } else {
          // Single winner (for backwards compatibility)
          const winnerInfo = playerMap.find((p) => p.address === game.winner);
          const winnerId = winnerInfo ? winnerInfo.id : "Unknown";
          const winnerWallet =
            winnerInfo?.walletAddress ||
            (await gameManager.getPlayerWalletAddress(game.winner)) ||
            game.winner;
          statusMessage += `\nWinner: ${winnerId} (${winnerWallet.substring(0, 10)}...${winnerWallet.substring(winnerWallet.length - 6)})\n`;
        }
      }

      return statusMessage;
    }

    case "list": {
      const games = await gameManager.listActiveGames();
      if (games.length === 0) {
        return "No active games found.";
      }

      // Updated game descriptions with wallet addresses
      const gameDescriptions = await Promise.all(
        games.map(async (game) => {
          const creatorWallet =
            (await gameManager.getPlayerWalletAddress(game.creator)) ||
            game.creator;
          const shortCreatorWallet =
            creatorWallet.substring(0, 10) +
            "..." +
            creatorWallet.substring(creatorWallet.length - 6);

          return `Game ID: ${game.id}\nToss Amount: ${game.tossAmount} USDC\nStatus: ${game.status}\nPlayers: ${game.participants.length}\nCreator: ${shortCreatorWallet}\nGame Wallet: ${game.walletAddress}`;
        }),
      );

      return gameDescriptions.join("\n\n");
    }

    case "balance": {
      const balance = await gameManager.getUserBalance(xmtpUser.address);
      const walletAddress = await gameManager.getPlayerWalletAddress(
        xmtpUser.address,
      );
      return `Your USDC balance: ${balance}\nYour wallet address: ${walletAddress}`;
    }

    case "help":
      return `Available commands:
create <amount> - Create a new tossing game with specified USDC toss amount
join <gameId> <option> - Join an existing game with the specified ID and your chosen option
execute <gameId> - Execute the toss resolution (only for game creator)
status <gameId> - Check the status of a specific game
list - List all active games
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
 * Handle natural language tossing commands
 * @param prompt - The natural language prompt
 * @param userId - The user's identifier
 * @param gameManager - The game manager instance
 * @param agent - The CDP agent instance
 * @param agentConfig - The CDP agent configuration
 * @returns Response message to send back to the user
 */
async function handleNaturalLanguageCommand(
  prompt: string,
  xmtpUser: XMTPUser,
  gameManager: GameManager,
  agent: ReturnType<typeof createReactAgent>,
  agentConfig: AgentConfig,
): Promise<string> {
  try {
    console.log(`🧠 Processing natural language prompt: "${prompt}"`);

    // Check if user has sufficient balance (default check for minimum amount)
    const balance = await gameManager.getUserBalance(xmtpUser.address);
    if (balance < 0.01) {
      return `Insufficient USDC balance. You need at least 0.01 USDC to create a toss. Your balance: ${balance} USDC`;
    }

    // Create a game using the natural language prompt
    const game = await gameManager.createGameFromPrompt(
      xmtpUser.address,
      prompt,
      agent,
      agentConfig,
    );

    // Create a detailed response with the parsed information
    let response = `🎲 Toss Created! ��\n\n`;
    response += `Game ID: ${game.id}\n`;
    response += `Topic: "${game.tossTopic}"\n`;

    if (game.tossOptions && game.tossOptions.length === 2) {
      response += `Options: ${game.tossOptions[0]} or ${game.tossOptions[1]}\n`;
    }

    response += `Toss Amount: ${game.tossAmount} USDC\n\n`;
    response += `You need to join your own game first by choosing an option: join ${game.id} <option>\n\n`;
    response += `Other players can join with: join ${game.id} <option>\n`;
    response += `When everyone has joined, you can execute the toss with: execute ${game.id}`;

    return response;
  } catch (error) {
    console.error("Error processing natural language command:", error);
    return `Sorry, I couldn't process your natural language toss. Please try again with a different wording or use explicit commands.

Example: "Will the price of Bitcoin reach $100k this year for 5"
Or use: create <amount> - to create a standard coin toss game`;
  }
}
