# Discord Happy Manager Bot

Discord bot for motivational messages and team well-being. The positive sister/brother of Grumpy!

## Features

- 📅 **Scheduled Messages**: 2-3 automated positive messages per day with timezone support
- ⚡ **Slash Commands**: `/happy now`, `/happy settings`, `/happy kudos`, `/happy test`
- 🎯 **Categories**: Motivation, Wellbeing, Focus, Team, Fun
- 🔄 **Anti-repetition**: No duplicate messages within 30 days
- 🌐 **Multi-guild**: Support multiple Discord servers with per-guild configuration
- 🔒 **Safe Content**: Filtered and appropriate messages only
- 🤖 **Dual Content Sources**: Local pack (200 messages) + Quotable.io API fallback
- 🧪 **Dry-run Testing**: Preview messages with `/happy test` before going live

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))

### Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**, give it a name
3. Go to **Bot** section, click **Add Bot**
4. Under **Token**, click **Reset Token** and copy it (you'll need this for `.env`)
5. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent (optional, not currently used)
6. Go to **OAuth2 > URL Generator**
7. Select scopes: `bot`, `applications.commands`
8. Select bot permissions: `Send Messages`, `Embed Links`, `Read Message History`
9. Copy the generated URL and open it to invite the bot to your server

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd discord-happy-manager

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Discord credentials
nano .env
```

Required environment variables:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
```

### Development

```bash
# Run in development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint
npm run lint:fix

# Run tests
npm test
npm run test:ui
npm run test:coverage
```

## Commands

### `/happy now`
Request an immediate motivational message.

**Options:**
- `category` (optional): Choose specific category (motivation, wellbeing, focus, team, fun)

**Cooldown:** 5 minutes per guild

**Example:**
```
/happy now
/happy now category:motivation
```

### `/happy settings`
Configure scheduled messages for your server (Admin only).

**Options:**
- `channel`: Channel where messages will be posted
- `timezone`: Server timezone (e.g., `Europe/Paris`, `America/New_York`)
- `cadence`: Number of messages per day (2 or 3)
- `active_days`: Days when messages are sent (e.g., `1,2,3,4,5` for Mon-Fri)
- `slot1`, `slot2`, `slot3`: Time slots in HH:MM format (e.g., `09:15`, `12:45`, `16:30`)

**Example:**
```
/happy settings channel:#general timezone:Europe/Paris cadence:3 active_days:1,2,3,4,5 slot1:09:15 slot2:12:45 slot3:16:30
```

### `/happy kudos`
Send public recognition to a team member.

**Options:**
- `member`: User to recognize
- `message` (optional): Custom kudos message (max 120 chars)

**Cooldown:** 5 minutes per user

**Example:**
```
/happy kudos member:@Alice
/happy kudos member:@Bob message:Great work on the deployment!
```

### `/happy test`
Preview messages in dry-run mode (Admin only). Does not record messages or set cooldowns.

**Options:**
- `count` (optional): Number of messages to preview (1-5, default: 3)
- `category` (optional): Filter by category

**Example:**
```
/happy test
/happy test count:5 category:motivation
```

## Project Structure

```
discord-happy-manager/
├── src/
│   ├── bot/           # Discord client & command registration
│   ├── commands/      # Slash command implementations
│   ├── scheduler/     # Scheduled message jobs
│   ├── content/       # Content providers & filters
│   ├── db/           # Database repositories & migrations
│   ├── config/        # Environment & constants
│   ├── listeners/     # Event handlers
│   ├── utils/         # Helper functions
│   └── types/         # TypeScript type definitions
├── data/              # SQLite database (gitignored)
├── roadmap/           # Project documentation & specs
└── resources/         # AI best practices (gitignored)
```

## Configuration

See `.env.example` for all available environment variables.

### Required Variables
- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application ID

### Optional Variables
- `SQLITE_PATH`: Path to SQLite database (default: `./data/happy.db`)
- `DEFAULT_TIMEZONE`: Default timezone for scheduled messages (default: `Europe/Paris`)
- `LOG_LEVEL`: Logging verbosity (default: `info`)

### Scheduler Configuration

The bot runs a cron job every minute (`* * * * *`) to check for scheduled messages. Each guild can configure:
- **Timezone**: Messages are sent according to the guild's local time
- **Cadence**: 2 or 3 messages per day
- **Active Days**: 1-7 (1=Monday, 7=Sunday, ISO 8601)
- **Time Slots**: Customizable HH:MM slots (e.g., `09:15`, `12:45`, `16:30`)
- **Slot Mapping**:
  - Slot 1 (default `09:15`) → `motivation` category
  - Slot 2 (default `12:45`) → `wellbeing` category
  - Slot 3 (default `16:30`) → `team` category (cadence 3 only)

## Deployment

### Production with PM2

```bash
# Build the project
npm run build

# Install PM2 globally (if not already installed)
npm install -g pm2

# Start the bot with PM2
pm2 start dist/index.js --name discord-happy-manager

# Save PM2 process list
pm2 save

# Set PM2 to start on system boot
pm2 startup
```

### PM2 Commands

```bash
# View logs
pm2 logs discord-happy-manager

# Restart bot
pm2 restart discord-happy-manager

# Stop bot
pm2 stop discord-happy-manager

# Monitor status
pm2 status
```

## Development Status

- [x] Phase 1: Setup & Infrastructure
- [x] Phase 2: Database & Repositories
- [x] Phase 3: Bot Core & Commands
- [x] Phase 4: Content System
- [x] Phase 5: Scheduler
- [x] Phase 6: Advanced Commands
- [ ] Phase 7: Contextual Mode (Future enhancement)
- [x] Phase 8: Tests & Release

**Current Version:** 1.0.0

**Test Coverage:** 100 tests (9 test files)
- Unit tests: Content filters, formatters, scheduler, database repositories
- Integration tests: All slash commands (`/happy now`, `/happy kudos`, `/happy test`)

## Documentation

- [Development Plan](./roadmap/plan-developpement.md)
- [Technical Specification](./roadmap/spec.md)
- [Project Requirements](./roadmap/prompt.md)

## License

MIT
