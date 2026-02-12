/**
 * Discord Client Setup
 *
 * Creates and configures the Discord bot client with proper intents
 * and event handlers.
 *
 * @remarks
 * - Uses discord.js v14
 * - Intents: Guilds (required for slash commands)
 * - GuildMessages and MessageContent only if contextual mode is needed
 *
 * @security
 * - Token loaded from environment (never hardcoded)
 * - Minimal intents for privacy
 *
 * @example
 * ```typescript
 * import { client, initializeClient } from '@/bot/client';
 *
 * await initializeClient();
 * console.log(`Bot logged in as ${client.user?.tag}`);
 * ```
 */

import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { env } from '@/config/env';
import { APP } from '@/config/constants';

/**
 * Discord client instance.
 *
 * @remarks
 * Exported for use in commands and other modules.
 * Do not create multiple clients - use this singleton.
 */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Required for slash commands
    // GuildMessages and MessageContent are only needed for contextual mode
    // We'll add them dynamically if needed
  ],
});

/**
 * Initializes the Discord client and connects to Discord.
 *
 * @throws {Error} If login fails
 *
 * @remarks
 * - Sets up event handlers
 * - Logs in to Discord
 * - Returns when ready event is fired
 *
 * @example
 * ```typescript
 * await initializeClient();
 * console.log('Bot is ready!');
 * ```
 */
export async function initializeClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ready event - bot is connected and ready
    client.once(Events.ClientReady, (readyClient) => {
      console.log(`✅ Bot logged in as ${readyClient.user.tag}`);
      console.log(`📊 Connected to ${readyClient.guilds.cache.size} guilds`);

      // Set bot status
      readyClient.user.setPresence({
        activities: [
          {
            name: 'positive vibes ☀️',
            type: ActivityType.Custom,
          },
        ],
        status: 'online',
      });

      resolve();
    });

    // Error event
    client.on(Events.Error, (error) => {
      console.error('❌ Discord client error:', error);
    });

    // Warn event
    client.on(Events.Warn, (warning) => {
      console.warn('⚠️  Discord client warning:', warning);
    });

    // Guild create event (bot joins a server)
    client.on(Events.GuildCreate, (guild) => {
      console.log(`➕ Joined guild: ${guild.name} (ID: ${guild.id})`);
    });

    // Guild delete event (bot leaves a server)
    client.on(Events.GuildDelete, (guild) => {
      console.log(`➖ Left guild: ${guild.name} (ID: ${guild.id})`);
      // TODO: Cleanup guild config and data
    });

    // Login to Discord
    client
      .login(env.DISCORD_TOKEN)
      .catch((error) => {
        console.error('❌ Failed to login to Discord:', error);
        reject(error);
      });
  });
}

/**
 * Gracefully shuts down the Discord client.
 *
 * @remarks
 * Should be called on process termination.
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', async () => {
 *   await shutdownClient();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownClient(): Promise<void> {
  console.log('🔌 Shutting down Discord client...');
  client.destroy();
  console.log('✅ Discord client shut down');
}
