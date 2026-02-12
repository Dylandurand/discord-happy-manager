/**
 * /happy settings Command
 *
 * Displays and allows modification of bot configuration for the server.
 * Admin-only command.
 *
 * @remarks
 * - Admin only (Administrator permission required)
 * - Shows current configuration
 * - Future: Interactive buttons/modals for configuration
 *
 * @example
 * User (admin): /happy settings
 * Bot: Shows current config with instructions
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { guildConfigRepo } from '@/db';
import { DISCORD, SCHEDULER } from '@/config/constants';
import { isAdmin, replyEphemeral } from '@/utils/commandHelpers';

/**
 * Executes the /happy settings command.
 *
 * @param interaction - Discord command interaction
 *
 * @throws {Error} If command execution fails
 *
 * @remarks
 * Command flow:
 * 1. Check admin permission
 * 2. Get or create guild config
 * 3. Display current settings in embed
 * 4. (Future) Show buttons for modification
 *
 * @example
 * ```typescript
 * // In interaction handler
 * if (subcommand === 'settings') {
 *   await executeHappySettings(interaction);
 * }
 * ```
 */
export async function executeHappySettings(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await replyEphemeral(interaction, '❌ This command can only be used in a server');
    return;
  }

  // Check admin permission
  if (!isAdmin(interaction)) {
    await replyEphemeral(
      interaction,
      '❌ Only server administrators can use this command'
    );
    return;
  }

  const guildId = interaction.guild.id;

  try {
    // Get current config or create default
    let config = guildConfigRepo.get(guildId);

    if (!config) {
      // Create default configuration
      const newConfig = {
        guildId,
        channelId: interaction.channelId, // Default to current channel
        timezone: SCHEDULER.DEFAULT_TIMEZONE,
        cadence: SCHEDULER.DEFAULT_CADENCE as 2 | 3,
        activeDays: [...SCHEDULER.DEFAULT_ACTIVE_DAYS],
        scheduleTimes: [...SCHEDULER.DEFAULT_TIMES_2],
        contextualEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      guildConfigRepo.upsert(newConfig);
      console.log(`✨ Created default config for guild ${interaction.guild.name}`);

      // Re-fetch to ensure we have the saved config
      config = guildConfigRepo.get(guildId);

      if (!config) {
        throw new Error('Failed to create guild configuration');
      }
    }

    // Check if user provided any options (update mode)
    const channel = interaction.options.getChannel('channel');
    const timezone = interaction.options.getString('timezone');
    const cadence = interaction.options.getInteger('cadence');
    const activeDaysStr = interaction.options.getString('active_days');
    const slot1 = interaction.options.getString('slot1');
    const slot2 = interaction.options.getString('slot2');
    const slot3 = interaction.options.getString('slot3');
    const contextualMode = interaction.options.getBoolean('contextual_mode');

    const hasUpdates = channel || timezone || cadence || activeDaysStr || slot1 || slot2 || slot3 || contextualMode !== null;

    if (hasUpdates) {
      // Update mode - validate and apply changes
      const updates: Partial<typeof config> = {};

      if (channel) {
        // Check if it's a valid text channel type
        if (channel.type !== 0 && channel.type !== 5) { // 0 = GuildText, 5 = GuildAnnouncement
          await replyEphemeral(interaction, '❌ Please select a text channel');
          return;
        }
        updates.channelId = channel.id;
      }

      if (timezone) {
        // Basic timezone validation
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: timezone });
          updates.timezone = timezone;
        } catch {
          await replyEphemeral(
            interaction,
            `❌ Invalid timezone: ${timezone}\n💡 Examples: Europe/Paris, America/New_York, Asia/Tokyo`
          );
          return;
        }
      }

      if (cadence) {
        updates.cadence = cadence as 2 | 3;
      }

      if (contextualMode !== null) {
        updates.contextualEnabled = contextualMode;
      }

      if (activeDaysStr) {
        // Parse and validate active days
        const dayNumbers = activeDaysStr.split(',').map((d) => parseInt(d.trim(), 10));
        if (dayNumbers.some((d) => isNaN(d) || d < 1 || d > 7)) {
          await replyEphemeral(
            interaction,
            '❌ Invalid active_days format. Use comma-separated numbers (1=Mon, 7=Sun)\n💡 Example: 1,2,3,4,5'
          );
          return;
        }
        updates.activeDays = dayNumbers;
      }

      // Handle schedule times
      const newSlots: string[] = [];
      if (slot1) {
        if (!isValidTimeFormat(slot1)) {
          await replyEphemeral(interaction, `❌ Invalid time format for slot1: ${slot1}\n💡 Use HH:MM (e.g., 09:15)`);
          return;
        }
        newSlots.push(slot1);
      }
      if (slot2) {
        if (!isValidTimeFormat(slot2)) {
          await replyEphemeral(interaction, `❌ Invalid time format for slot2: ${slot2}\n💡 Use HH:MM (e.g., 16:30)`);
          return;
        }
        newSlots.push(slot2);
      }
      if (slot3) {
        if (!isValidTimeFormat(slot3)) {
          await replyEphemeral(interaction, `❌ Invalid time format for slot3: ${slot3}\n💡 Use HH:MM (e.g., 12:45)`);
          return;
        }
        newSlots.push(slot3);
      }

      // If any slots provided, validate count matches cadence
      if (newSlots.length > 0) {
        const targetCadence = updates.cadence ?? config.cadence;
        if (newSlots.length !== targetCadence) {
          await replyEphemeral(
            interaction,
            `❌ You must provide ${targetCadence} time slots for cadence ${targetCadence}\n💡 Provided: ${newSlots.length} slot(s)`
          );
          return;
        }
        updates.scheduleTimes = newSlots;
      }

      // Apply updates
      const updatedConfig = {
        ...config,
        ...updates,
        updatedAt: new Date(),
      };

      guildConfigRepo.upsert(updatedConfig);
      console.log(`⚙️  Updated config for guild ${interaction.guild.name}`);

      // Re-fetch updated config
      config = guildConfigRepo.get(guildId) ?? config;

      await replyEphemeral(interaction, '✅ Configuration updated successfully!');
    }

    // Build settings embed
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Happy Manager Settings')
      .setDescription(`Current configuration for **${interaction.guild.name}**`)
      .setColor(DISCORD.COLOR_INFO)
      .addFields(
        {
          name: '📺 Target Channel',
          value: `<#${config.channelId}>`,
          inline: true,
        },
        {
          name: '🌍 Timezone',
          value: config.timezone,
          inline: true,
        },
        {
          name: '📅 Messages per Day',
          value: `${config.cadence} messages`,
          inline: true,
        },
        {
          name: '⏰ Schedule Times',
          value: config.scheduleTimes.join(', '),
          inline: false,
        },
        {
          name: '📆 Active Days',
          value: formatActiveDays(config.activeDays),
          inline: false,
        },
        {
          name: '💬 Contextual Responses',
          value: config.contextualEnabled ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        }
      )
      .setFooter({
        text: '💡 Use /happy settings with options to modify configuration',
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });

    console.log(
      `⚙️  /happy settings viewed by ${interaction.user.tag} in ${interaction.guild.name}`
    );
  } catch (error) {
    console.error('❌ Error executing /happy settings:', error);
    await replyEphemeral(
      interaction,
      '❌ Failed to load settings. Please try again later.'
    );
  }
}

/**
 * Formats active days array to human-readable string.
 *
 * @param activeDays - Array of day numbers (1=Mon, 7=Sun)
 *
 * @returns Formatted string (e.g., "Monday - Friday")
 *
 * @example
 * ```typescript
 * formatActiveDays([1, 2, 3, 4, 5]); // "Monday - Friday"
 * formatActiveDays([1, 3, 5]); // "Monday, Wednesday, Friday"
 * ```
 */
function formatActiveDays(activeDays: number[]): string {
  const dayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const days = activeDays.map((day) => dayNames[day - 1]).filter(Boolean);

  if (days.length === 0) {
    return 'None';
  }

  // Check if it's weekdays
  if (
    activeDays.length === 5 &&
    activeDays.every((day) => day >= 1 && day <= 5)
  ) {
    return 'Monday - Friday (Weekdays)';
  }

  // Check if it's weekend
  if (activeDays.length === 2 && activeDays.includes(6) && activeDays.includes(7)) {
    return 'Saturday - Sunday (Weekend)';
  }

  // Check if it's all week
  if (activeDays.length === 7) {
    return 'Every day';
  }

  return days.join(', ');
}

/**
 * Validates time format (HH:MM).
 *
 * @param time - Time string to validate
 *
 * @returns True if valid HH:MM format
 *
 * @example
 * ```typescript
 * isValidTimeFormat('09:15'); // true
 * isValidTimeFormat('9:15'); // false (needs leading zero)
 * isValidTimeFormat('25:00'); // false (invalid hour)
 * ```
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}
