/**
 * /happy kudos Command
 *
 * Allows team members to publicly recognize a colleague with structured kudos.
 * Uses templates from roadmap/kudos.md with categories and variables.
 *
 * @remarks
 * - Available to all members (not admin-only)
 * - Cooldown: 5 minutes per user (prevents spam)
 * - Required: @user mention, category, reason, impact
 * - Posts in configured channel or interaction channel as fallback
 *
 * @example
 * User: /happy kudos user:@Alice category:vente reason:a clarifié son positionnement impact:client convaincu
 * Bot: 🎯 @Alice a renforcé son argumentaire.
 *      Preuve : a clarifié son positionnement. Impact direct : client convaincu.
 */

import type { ChatInputCommandInteraction, GuildMember, TextChannel } from 'discord.js';
import { COOLDOWNS } from '@/config/constants';
import { cooldownRepo } from '@/db';
import { replyEphemeral, formatDuration } from '@/utils/commandHelpers';
import { getKudosProvider, type KudosCategory } from '@/content/kudosProvider';

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
  const category = interaction.options.getString('category', true) as KudosCategory;
  const reason = interaction.options.getString('reason', true);
  const impact = interaction.options.getString('impact', true);

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

    // Format kudos message using templates
    const kudosProvider = getKudosProvider();
    const kudosMessage = kudosProvider.formatKudos(
      category,
      recipientMention,
      reason,
      impact
    );

    // Send kudos in the channel where the command was used
    const targetChannel = interaction.channel as TextChannel | null;
    if (targetChannel && targetChannel.isTextBased()) {
      await targetChannel.send(kudosMessage);
      await interaction.editReply('✅ Kudos envoyés !');
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
