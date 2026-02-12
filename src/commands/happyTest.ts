/**
 * /happy test Command
 *
 * Admin-only command to preview scheduled messages.
 * Sends 1-5 real messages with metadata, without recording them
 * in sent_messages (dry-run mode).
 *
 * @remarks
 * - Admin only
 * - Optional count parameter: 1-5 (default 3)
 * - Shows content id, category, provider for debugging
 * - Does NOT record in sentRepo (won't affect anti-repetition)
 * - Does NOT set cooldown (admin debugging tool)
 *
 * @example
 * User: /happy test count:3
 * Bot: Sends 3 preview messages with metadata
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import type { Category } from '@/types';
import { DISCORD, VALID_CATEGORIES } from '@/config/constants';
import { isAdmin, replyEphemeral } from '@/utils/commandHelpers';
import { getContentItem } from '@/content';
import { formatMessage } from '@/content/formatter';

/**
 * Executes the /happy test command.
 *
 * @param interaction - Discord command interaction
 *
 * @throws {Error} If command execution fails unexpectedly
 *
 * @remarks
 * Sends N messages in sequence with a small delay between each.
 * Each message is displayed with its metadata embed.
 *
 * @example
 * ```typescript
 * if (subcommand === 'test') {
 *   await executeHappyTest(interaction);
 * }
 * ```
 */
export async function executeHappyTest(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await replyEphemeral(interaction, '❌ Commande uniquement disponible sur un serveur');
    return;
  }

  if (!isAdmin(interaction)) {
    await replyEphemeral(interaction, '❌ Commande réservée aux administrateurs');
    return;
  }

  const count = interaction.options.getInteger('count') ?? 3;
  const requestedCategory = interaction.options.getString('category') as Category | null;

  await interaction.deferReply({ ephemeral: true });

  const results: string[] = [];
  const errors: string[] = [];

  // Pick categories to test (cycle through all if no specific category)
  const categoriesToTest = requestedCategory
    ? Array<Category>(count).fill(requestedCategory)
    : pickCategories(count);

  for (let i = 0; i < count; i++) {
    const category = categoriesToTest[i]!;

    try {
      // Dry-run: fetch without recording
      const item = await getContentItem({
        guildId: interaction.guild.id,
        category,
        localOnly: false,
      });

      const formatted = formatMessage(item);

      results.push(
        `**[${i + 1}/${count}]** \`${item.id}\` · ${item.category} · ${item.provider}\n${formatted}`
      );
    } catch (error) {
      errors.push(`[${i + 1}/${count}] category:${category} — ${String(error)}`);
    }
  }

  // Build summary embed
  const embed = new EmbedBuilder()
    .setTitle(`🧪 Test — ${count} message${count > 1 ? 's' : ''}`)
    .setColor(DISCORD.COLOR_INFO)
    .setDescription(
      results.length > 0
        ? results.join('\n\n---\n\n')
        : '❌ Aucun message récupéré'
    )
    .setFooter({ text: 'Mode dry-run — aucun enregistrement en base' })
    .setTimestamp();

  if (errors.length > 0) {
    embed.addFields({
      name: '⚠️ Erreurs',
      value: errors.join('\n'),
    });
  }

  await interaction.editReply({ embeds: [embed] });

  console.log(
    `🧪 /happy test × ${count} by ${interaction.user.tag} in "${interaction.guild.name}"` +
      (requestedCategory ? ` (category: ${requestedCategory})` : '')
  );
}

/**
 * Picks N categories cycling through all available categories.
 *
 * @param count - Number of categories to pick
 *
 * @returns Array of categories, cycling if count > number of categories
 *
 * @example
 * ```typescript
 * pickCategories(3); // ['motivation', 'wellbeing', 'focus']
 * pickCategories(7); // ['motivation', 'wellbeing', 'focus', 'team', 'fun', 'motivation', 'wellbeing']
 * ```
 */
function pickCategories(count: number): Category[] {
  const result: Category[] = [];
  for (let i = 0; i < count; i++) {
    result.push(VALID_CATEGORIES[i % VALID_CATEGORIES.length]!);
  }
  return result;
}
