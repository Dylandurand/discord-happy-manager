/**
 * /happy now Command
 *
 * Sends a motivational message immediately on-demand.
 * Respects 60-second cooldown to prevent spam.
 *
 * @remarks
 * - Cooldown: 60 seconds per guild
 * - Optional category parameter
 * - Posts to configured channel or interaction channel
 *
 * @example
 * User: /happy now
 * Bot: Posts message in configured channel
 *
 * User: /happy now category:motivation
 * Bot: Posts motivation message
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type { Category } from '@/types';
import { cooldownRepo } from '@/db';
import { COOLDOWNS } from '@/config/constants';
import { replyEphemeral, formatDuration } from '@/utils/commandHelpers';

/**
 * Executes the /happy now command.
 *
 * @param interaction - Discord command interaction
 *
 * @throws {Error} If command execution fails
 *
 * @remarks
 * Command flow:
 * 1. Check cooldown (60s per guild)
 * 2. Get optional category parameter
 * 3. Fetch content from provider (TODO: Phase 4)
 * 4. Post to configured channel or interaction channel
 * 5. Set cooldown
 *
 * @example
 * ```typescript
 * // In interaction handler
 * if (subcommand === 'now') {
 *   await executeHappyNow(interaction);
 * }
 * ```
 */
export async function executeHappyNow(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await replyEphemeral(interaction, '❌ This command can only be used in a server');
    return;
  }

  const guildId = interaction.guild.id;

  // Check cooldown
  const cooldownKey = `guild:${guildId}:now`;
  const remainingMs = cooldownRepo.getRemainingMs(cooldownKey);

  if (remainingMs > 0) {
    const remainingSec = Math.ceil(remainingMs / 1000);
    await replyEphemeral(
      interaction,
      `⏰ Please wait ${formatDuration(remainingSec)} before using this command again`
    );
    return;
  }

  // Get category parameter (optional)
  const category = interaction.options.getString('category') as Category | null;

  try {
    // TODO: Phase 4 - Get content from provider
    // For now, send placeholder
    const placeholderMessage = category
      ? `✨ [${category}] Message will be implemented in Phase 4 (Content System)`
      : '✨ Random message will be implemented in Phase 4 (Content System)';

    // Send message to interaction channel for now
    // TODO: Use configured channel from guild_config
    await interaction.reply({
      content: `✅ Posted!\n\n${placeholderMessage}`,
      ephemeral: false,
    });

    // Set cooldown
    cooldownRepo.setWithDuration(cooldownKey, COOLDOWNS.NOW_COMMAND);

    console.log(
      `📤 /happy now executed by ${interaction.user.tag} in ${interaction.guild.name}` +
        (category ? ` (category: ${category})` : '')
    );
  } catch (error) {
    console.error('❌ Error executing /happy now:', error);
    await replyEphemeral(
      interaction,
      '❌ Failed to send message. Please try again later.'
    );
  }
}
