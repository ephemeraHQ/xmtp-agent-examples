# XMTP User Memory Agent

An XMTP agent that persistently stores user details and preferences across chat sessions. This agent maintains user profiles, conversation history, notes, and preferences in local JSON files, ensuring data persists even when the agent restarts.

![User Memory Agent](https://img.shields.io/badge/XMTP-Agent-blue) ![Node.js](https://img.shields.io/badge/Node.js-20+-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue)

## Features

🧠 **Persistent Memory**: User data is stored locally and persists across sessions
👤 **User Profiles**: Store names, emails, addresses, and preferences
📝 **Notes System**: Users can save personal notes with timestamps
🏷️ **Tagging System**: Organize users with custom tags
📊 **Activity Tracking**: Monitor conversation statistics and user engagement
⚙️ **Preferences**: Customizable user settings (timezone, language, notifications)
🔒 **Privacy Focused**: All data stored locally, no external services required

## How It Works

1. **Automatic Profile Creation**: When a user first messages the agent, a profile is automatically created
2. **Command Processing**: Users interact with the agent using simple text commands
3. **Persistent Storage**: All user data is stored in JSON files in the `.data/user-profiles/` directory
4. **Session Continuity**: Data persists across agent restarts and conversations

## Storage Structure

```
.data/
├── user-profiles/
│   ├── [inboxId1].json
│   ├── [inboxId2].json
│   └── ...
└── xmtp/
    └── [env]-memory-agent.db3
```

Each user profile contains:
- Basic information (name, email, address)
- Preferences (timezone, language, notifications)
- Notes with timestamps
- Tags for organization
- Conversation history and statistics

## Commands

### Profile Management
- `/profile` - View your complete profile
- `/set name <name>` - Set your display name
- `/set email <email>` - Set your email address
- `/set timezone <timezone>` - Set your timezone
- `/set language <language>` - Set your preferred language

### Notes & Organization
- `/add note <note>` - Add a personal note
- `/notes` - View all your saved notes
- `/add tag <tag>` - Add a tag to your profile
- `/tags` - View all your tags
- `/clear notes` - Remove all notes
- `/clear tags` - Remove all tags

### Preferences
- `/set notifications on/off` - Toggle notifications
- `/preferences` - View your current preferences

### Statistics
- `/stats` - View your conversation statistics

### Help
- `/help` - Show all available commands

## Installation

1. Navigate to the agent directory:
```bash
cd examples/xmtp-user-memory
```

2. Install dependencies:
```bash
yarn install
```

3. Generate keys:
```bash
yarn gen:keys
```

4. Set up your environment variables in `.env`:
```bash
WALLET_KEY=your_private_key_here
ENCRYPTION_KEY=your_encryption_key_here
XMTP_ENV=dev
```

## Usage

### Development Mode (with hot-reloading)
```bash
yarn dev
```

### Production Mode
```bash
yarn start
```

### Build
```bash
yarn build
```

## Example Interaction

```
User: Hello!
Agent: Hello! 👋 I'm your personal memory agent. I remember your details across all our conversations!

Type `/help` to see what I can do for you, or `/profile` to view your saved information.

💡 Quick tip: You can start by setting your name with `/set name <your name>`

User: /set name Alice
Agent: ✅ Name updated to: **Alice**

User: /add note Remember to check the project deadline
Agent: ✅ Note added: **Remember to check the project deadline**

User: /profile
Agent: 👤 **Your Profile:**

**Basic Info:**
• Name: Alice
• Email: Not set
• Address: 0x1234...5678
• Member since: 12/15/2024

**Preferences:**
• Language: Not set
• Timezone: Not set
• Notifications: Disabled

**Activity:**
• Total messages: 3
• Last seen: 12/15/2024, 2:30:45 PM
• Notes: 1
• Tags: 0
```

## Data Privacy

- All user data is stored locally on your server
- No external services or APIs are used for data storage
- User profiles are stored in individual JSON files
- The agent only has access to XMTP conversation data and user-provided information

## Architecture

The agent is built with:
- **TypeScript** for type safety
- **Node.js** for runtime
- **XMTP Node SDK** for messaging
- **File System** for persistent storage
- **JSON** for data serialization

## Storage Schema

```typescript
interface UserProfile {
  inboxId: string;
  address?: string;
  name?: string;
  email?: string;
  preferences?: {
    notifications?: boolean;
    language?: string;
    timezone?: string;
  };
  notes?: string[];
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  conversationHistory?: {
    lastSeen: string;
    messageCount: number;
  };
}
```

## Error Handling

The agent includes comprehensive error handling:
- File system errors (permissions, disk space)
- JSON parsing errors
- XMTP communication errors
- Graceful shutdown on system signals

## Monitoring

The agent logs all important activities:
- User profile creation and updates
- Message processing
- Error conditions
- System events

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE.md](../../LICENSE.md) file for details.

## Support

For support, please:
1. Check the [XMTP documentation](https://docs.xmtp.org/)
2. Review existing [GitHub issues](https://github.com/xmtp/xmtp-node-js-tools/issues)
3. Create a new issue if needed

## Related Examples

- [xmtp-gm](../xmtp-gm/) - Simple greeting agent
- [xmtp-gpt](../xmtp-gpt/) - GPT-powered conversational agent
- [xmtp-coinbase-agentkit](../xmtp-coinbase-agentkit/) - Agent with wallet integration