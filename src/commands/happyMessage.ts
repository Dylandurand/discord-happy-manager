/**
 * /happy message Command
 *
 * Allows admins to post a free-form message in the bot's name.
 * Unlike /happy kudos, there is no template or structure — the message
 * is sent exactly as typed.
 *
 * @remarks
 * - Admin-only (requires Administrator permission)
 * - Optional channel target (defaults to current channel)
 * - Reply to the admin is ephemeral (only visible to them)
 *
 * @example
 * User: /happy message content:Bonne semaine à tous ! channel:#général
 * Bot posts in #général: Bonne semaine à tous !
 */

import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { isAdmin, replyEphemeral, getGuildChannel } from '@/utils/commandHelpers';

/**
 * Executes the /happy message command.
 *
 * @param interaction - Discord command interaction
 *
 * @remarks
 * Command flow:
 * 1. Check admin permission
 * 2. Get content and optional target channel
 * 3. Resolve target channel (explicit > current)
 * 4. Post message as bot
 * 5. Confirm to admin (ephemeral)
 *
 * @example
 * ```typescript
 * if (subcommand === 'message') {
 *   await executeHappyMessage(interaction);
 * }
 * ```
 */
export async function executeHappyMessage(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await replyEphemeral(interaction, '❌ Commande uniquement disponible sur un serveur');
    return;
  }

  // Admin-only
  if (!isAdmin(interaction)) {
    await replyEphemeral(interaction, '❌ Cette commande est réservée aux administrateurs');
    return;
  }

  const content = interaction.options.getString('content', true);
  const channelOption = interaction.options.getChannel('channel', false);

  await interaction.deferReply({ ephemeral: true });

  try {
    let targetChannel: TextChannel | null = null;

    // Resolve target channel
    if (channelOption) {
      targetChannel = getGuildChannel(interaction.guild.id, channelOption.id);
      if (!targetChannel) {
        await interaction.editReply('❌ Impossible d\'accéder au salon sélectionné');
        return;
      }
    } else {
      targetChannel = interaction.channel as TextChannel | null;
    }

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.editReply('❌ Aucun salon texte disponible pour envoyer le message');
      return;
    }

    await targetChannel.send(content);
    await interaction.editReply(`✅ Message envoyé dans <#${targetChannel.id}>`);

    console.log(
      `📢 /happy message — ${interaction.user.tag} in "${interaction.guild.name}" → #${targetChannel.name}`
    );
  } catch (error) {
    console.error('❌ Error executing /happy message:', error);
    await interaction.editReply('❌ Impossible d\'envoyer le message. Réessayez plus tard.');
  }
}
