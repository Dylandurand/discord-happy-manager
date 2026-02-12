import { registerCommands } from '../src/bot/registerCommands';

// Guild ID for The Co-Brothers Hub
const GUILD_ID = '1468305469289402521';

registerCommands(GUILD_ID)
  .then(() => {
    console.log('✅ Commands registered successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to register commands:', error);
    process.exit(1);
  });
