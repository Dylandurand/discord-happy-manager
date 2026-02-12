/**
 * /happy kudos Command
 *
 * Allows team members to publicly recognize a colleague.
 * Posts a formatted kudos message in the configured channel.
 *
 * @remarks
 * - Available to all members (not admin-only)
 * - Cooldown: 5 minutes per user (prevents spam)
 * - Required: @user mention
 * - Optional: custom message (max 120 chars)
 * - Posts in configured channel or interaction channel as fallback
 *
 * @example
 * User: /happy kudos user:@Alice message:Super travail sur la démo !
 * Bot: 🎉 Kudos à @Alice — Super travail sur la démo !
 *      Tu fais avancer la ruche. Merci.
 */

import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { COOLDOWNS } from '@/config/constants';
import { cooldownRepo, guildConfigRepo } from '@/db';
import { replyEphemeral, formatDuration, getGuildChannel } from '@/utils/commandHelpers';

/**
 * Kudos message format template.
 *
 * @remarks
 * Stable format to ensure brand consistency across servers.
 */
const KUDOS_TEMPLATE = (recipientMention: string, message?: string): string => {
  const customMessage = message ? ` — ${message}` : '';
  return `🎉 **Kudos à ${recipientMention}**${customMessage}\n*Tu fais avancer la ruche. Merci.*`;
};

/**
 * Executes the /happy kudos command.
 *
 * @param interaction - Discord command interaction
 *
 * @throws {Error} If command execution fails unexpectedly
 *
 * @remarks
 * Command flow:
 * 1. Check per-user cooldown (5 min)
 * 2. Validate target user (cannot kudos yourself, cannot kudos bots)
 * 3. Format kudos message
 * 4. Post to configured channel or interaction channel
 * 5. Set cooldown
 *
 * @example
 * ```typescript
 * if (subcommand === 'kudos') {
 *   await executeHappyKudos(interaction);
 * }
 * ```
 */
export async function executeHappyKudos(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await replyEphemeral(interaction, '❌ Commande uniquement disponible sur un serveur');
    return;
  }

  const senderId = interaction.user.id;
  const guildId = interaction.guild.id;

  // Check per-user cooldown
  const cooldownKey = `user:${senderId}:kudos`;
  const remainingMs = cooldownRepo.getRemainingMs(cooldownKey);

  if (remainingMs > 0) {
    const remainingSec = Math.ceil(remainingMs / 1000);
    await replyEphemeral(
      interaction,
      `⏰ Attendez encore ${formatDuration(remainingSec)} avant d'envoyer de nouveaux kudos`
    );
    return;
  }

  // Get parameters
  const targetUser = interaction.options.getUser('user', true);
  const customMessage = interaction.options.getString('message');

  // Validate: cannot kudos yourself
  if (targetUser.id === senderId) {
    await replyEphemeral(interaction, '😅 Vous ne pouvez pas vous envoyer des kudos à vous-même');
    return;
  }

  // Validate: cannot kudos a bot
  if (targetUser.bot) {
    await replyEphemeral(interaction, '🤖 Les bots n\'ont pas besoin de kudos (pour l\'instant)');
    return;
  }

  // Validate custom message length
  if (customMessage && customMessage.length > 120) {
    await replyEphemeral(
      interaction,
      `❌ Le message est trop long (${customMessage.length}/120 caractères)`
    );
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get target member for mention
    let recipientMention: string;
    try {
      const member = await interaction.guild.members.fetch(targetUser.id) as GuildMember;
      recipientMention = member.toString();
    } catch {
      recipientMention = targetUser.toString();
    }

    // Format kudos message
    const kudosMessage = KUDOS_TEMPLATE(recipientMention, customMessage ?? undefined);

    // Determine target channel: configured > interaction channel
    const config = guildConfigRepo.get(guildId);
    let targetChannel: TextChannel | null = null;

    if (config?.channelId) {
      targetChannel = getGuildChannel(guildId, config.channelId);
    }

    if (targetChannel) {
      await targetChannel.send(kudosMessage);
      await interaction.editReply(`✅ Kudos envoyés dans <#${targetChannel.id}> !`);
    } else {
      await interaction.editReply({ content: '✅ Kudos envoyés !' });
      await interaction.followUp({
        content: kudosMessage,
        ephemeral: false,
      });
    }

    // Set cooldown
    cooldownRepo.setWithDuration(cooldownKey, COOLDOWNS.KUDOS_COMMAND);

    console.log(
      `🎉 /happy kudos — ${interaction.user.tag} → ${targetUser.tag} in "${interaction.guild.name}"`
    );
  } catch (error) {
    console.error('❌ Error executing /happy kudos:', error);
    await interaction.editReply('❌ Impossible d\'envoyer les kudos. Réessayez plus tard.');
  }
}
