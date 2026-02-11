# Discord Happy Manager Bot

Discord bot for motivational messages and team well-being. The positive sister/brother of Grumpy!

## Features (Planned)

- 📅 **Scheduled Messages**: 2-3 automated positive messages per day
- ⚡ **Slash Commands**: `/happy now`, `/happy settings`, `/happy kudos`, `/happy test`
- 🎯 **Categories**: Motivation, Wellbeing, Focus, Team, Fun
- 🔄 **Anti-repetition**: No duplicate messages within 30 days
- 🌐 **Multi-guild**: Support multiple Discord servers
- 🔒 **Safe Content**: Filtered and appropriate messages only

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Discord Bot Token ([Create one here](https://discord.com/developers/applications))

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Discord token
nano .env
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

Key variables:
- `DISCORD_TOKEN`: Your Discord bot token (required)
- `DISCORD_CLIENT_ID`: Your Discord application ID (required)
- `SQLITE_PATH`: Path to SQLite database (default: `./data/happy.db`)
- `DEFAULT_TIMEZONE`: Default timezone for scheduled messages (default: `Europe/Paris`)

## Development Status

- [x] Phase 1: Setup & Infrastructure (In Progress)
- [ ] Phase 2: Database & Repositories
- [ ] Phase 3: Bot Core & Commands
- [ ] Phase 4: Content System
- [ ] Phase 5: Scheduler
- [ ] Phase 6: Advanced Commands
- [ ] Phase 7: Contextual Mode (Optional)
- [ ] Phase 8: Tests & Release

## Documentation

- [Development Plan](./roadmap/plan-developpement.md)
- [Technical Specification](./roadmap/spec.md)
- [Project Requirements](./roadmap/prompt.md)

## License

MIT
