/**
 * Slash Command Registration
 *
 * Registers application commands (slash commands) with Discord API.
 * Commands can be registered globally or per-guild.
 *
 * @remarks
 * - Guild commands update instantly (recommended for development)
 * - Global commands take up to 1 hour to propagate
 * - We use global commands for production
 *
 * @security
 * - Commands are public by default
 * - Permission checks happen in command execution
 *
 * @example
 * ```typescript
 * import { registerCommands } from '@/bot/registerCommands';
 *
 * await registerCommands();
 * console.log('Commands registered!');
 * ```
 */

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { env } from '@/config/env';

/**
 * Command definitions.
 *
 * @remarks
 * Each command is defined using SlashCommandBuilder.
 * Command handlers are implemented in separate files in /commands.
 */
const commands = [
  // /happy now [category?]
  new SlashCommandBuilder()
    .setName('happy')
    .setDescription('Happy Manager commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('now')
        .setDescription('Post a motivational message right now')
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Message category')
            .setRequired(false)
            .addChoices(
              { name: 'Motivation', value: 'motivation' },
              { name: 'Wellbeing', value: 'wellbeing' },
              { name: 'Focus', value: 'focus' },
              { name: 'Team', value: 'team' },
              { name: 'Fun', value: 'fun' }
            )
        )
    )
    // /happy settings
    .addSubcommand((subcommand) =>
      subcommand
        .setName('settings')
        .setDescription('Configure Happy Manager for this server (Admin only)')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel where scheduled messages will be posted')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('timezone')
            .setDescription('Server timezone (e.g., Europe/Paris, America/New_York)')
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName('cadence')
            .setDescription('Number of messages per day')
            .setRequired(false)
            .addChoices(
              { name: '2 messages per day', value: 2 },
              { name: '3 messages per day', value: 3 }
            )
        )
        .addStringOption((option) =>
          option
            .setName('active_days')
            .setDescription('Active days (1=Mon, 7=Sun, e.g., "1,2,3,4,5" for weekdays)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('slot1')
            .setDescription('First message time (HH:MM format, e.g., 09:15)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('slot2')
            .setDescription('Second message time (HH:MM format, e.g., 16:30)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('slot3')
            .setDescription('Third message time (HH:MM format, e.g., 12:45)')
            .setRequired(false)
        )
    )
    // /happy test [count?]
    .addSubcommand((subcommand) =>
      subcommand
        .setName('test')
        .setDescription('Test message variety (Admin only)')
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('Number of test messages to send')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Filter by category (optional)')
            .setRequired(false)
            .addChoices(
              { name: 'Motivation', value: 'motivation' },
              { name: 'Wellbeing', value: 'wellbeing' },
              { name: 'Focus', value: 'focus' },
              { name: 'Team', value: 'team' },
              { name: 'Fun', value: 'fun' }
            )
        )
    )
    // /happy kudos @user [message?]
    .addSubcommand((subcommand) =>
      subcommand
        .setName('kudos')
        .setDescription('Send kudos to a team member')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to give kudos to')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('message')
            .setDescription('Optional kudos message')
            .setRequired(false)
            .setMaxLength(120)
        )
    ),
].map((command) => command.toJSON());

/**
 * Registers slash commands with Discord API.
 *
 * @param guildId - Optional guild ID for guild-specific registration (dev mode)
 *
 * @throws {Error} If registration fails
 *
 * @remarks
 * - In development: registers to specific guild (instant update)
 * - In production: registers globally (up to 1h propagation)
 *
 * @example
 * ```typescript
 * // Development: register to specific guild
 * await registerCommands('123456789');
 *
 * // Production: register globally
 * await registerCommands();
 * ```
 */
export async function registerCommands(guildId?: string): Promise<void> {
  try {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

    console.log(`🔄 Registering ${commands.length} slash commands...`);

    if (guildId) {
      // Guild-specific registration (development)
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
        body: commands,
      });
      console.log(`✅ Commands registered for guild ${guildId}`);
    } else {
      // Global registration (production)
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: commands,
      });
      console.log('✅ Commands registered globally (may take up to 1 hour to propagate)');
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    throw error;
  }
}

/**
 * Deletes all registered commands.
 *
 * @param guildId - Optional guild ID for guild-specific deletion
 *
 * @throws {Error} If deletion fails
 *
 * @remarks
 * Useful for development to clean up old commands.
 *
 * @example
 * ```typescript
 * await deleteCommands('123456789');
 * ```
 */
export async function deleteCommands(guildId?: string): Promise<void> {
  try {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

    console.log('🗑️  Deleting all commands...');

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
        body: [],
      });
      console.log(`✅ Commands deleted for guild ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: [],
      });
      console.log('✅ Commands deleted globally');
    }
  } catch (error) {
    console.error('❌ Failed to delete commands:', error);
    throw error;
  }
}
