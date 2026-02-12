/**
 * /happy now Command
 *
 * Sends a motivational message immediately on-demand.
 * Respects 60-second cooldown to prevent spam.
 *
 * @remarks
 * - Cooldown: 60 seconds per guild
 * - Optional category parameter
 * - Posts to configured channel or falls back to interaction channel
 * - Records sent message for anti-repetition tracking
 *
 * @example
 * User: /happy now
 * Bot: Posts message in configured channel
 *
 * User: /happy now category:motivation
 * Bot: Posts motivation message
 */

import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import type { Category } from '@/types';
import { cooldownRepo, guildConfigRepo } from '@/db';
import { COOLDOWNS } from '@/config/constants';
import { replyEphemeral, formatDuration, getGuildChannel } from '@/utils/commandHelpers';
import { getFormattedContent, recordSentContent } from '@/content';

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
 * 3. Fetch and format content from provider (API → Local fallback)
 * 4. Post to configured channel or interaction channel
 * 5. Record sent content for anti-repetition
 * 6. Set cooldown
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
      `⏰ Attendez encore ${formatDuration(remainingSec)} avant de relancer cette commande`
    );
    return;
  }

  // Get category parameter (optional)
  const category = interaction.options.getString('category') as Category | null;

  // Defer reply since content fetching (API call) may take > 3s
  await interaction.deferReply({ ephemeral: true });

  try {
    // Fetch formatted content (API → local fallback)
    const result = await getFormattedContent({
      guildId,
      category: category ?? undefined,
    });

    // Determine target channel: configured channel > interaction channel
    const config = guildConfigRepo.get(guildId);
    let targetChannel: TextChannel | null = null;

    if (config?.channelId) {
      targetChannel = getGuildChannel(guildId, config.channelId);
    }

    if (targetChannel) {
      // Post to configured channel
      await targetChannel.send(result.message);

      // Record in the correct channelId
      recordSentContent(guildId, targetChannel.id, result.item);

      await interaction.editReply('✅ Message envoyé dans le canal configuré !');
    } else {
      // Fallback: post in interaction channel as non-ephemeral followup
      await interaction.editReply({ content: '✅ Voici votre message :' });
      await interaction.followUp({
        content: result.message,
        ephemeral: false,
      });

      // Record with interaction channel
      recordSentContent(guildId, interaction.channelId ?? '', result.item);
    }

    // Set cooldown after successful delivery
    cooldownRepo.setWithDuration(cooldownKey, COOLDOWNS.NOW_COMMAND);

    console.log(
      `📤 /happy now → ${interaction.user.tag} in "${interaction.guild.name}"` +
        ` [${result.item.category}/${result.item.provider}]` +
        (category ? ` (requested: ${category})` : '')
    );
  } catch (error) {
    console.error('❌ Error executing /happy now:', error);
    await interaction.editReply('❌ Impossible d\'envoyer le message. Réessayez plus tard.');
  }
}
