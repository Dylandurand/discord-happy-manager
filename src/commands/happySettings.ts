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
        text: '💡 Configuration will be editable via buttons in Phase 3 completion',
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
