/**
 * Message Formatter
 *
 * Formats ContentItems into Discord-ready message strings.
 * Applies templates based on message type and category.
 *
 * @remarks
 * Three templates exist:
 * - Kick-off (morning): energetic, action-oriented prefix
 * - Reset (midday): calming, break-oriented prefix
 * - Citation (afternoon/team): quote-style with attribution
 *
 * The formatter also handles API quotes (Quotable format) vs local content.
 *
 * @example
 * ```typescript
 * const message = formatMessage(item, 'kickoff');
 * await channel.send(message);
 * ```
 */

import type { ContentItem } from '@/types';
import type { Category } from '@/config/constants';

/**
 * Message template types.
 *
 * @remarks
 * - kickoff: Morning motivation burst
 * - reset: Midday wellbeing/focus reset
 * - citation: Afternoon quote or team message
 * - direct: No template, send text as-is
 */
export type MessageTemplate = 'kickoff' | 'reset' | 'citation' | 'direct';

/**
 * Category to template mapping based on slot time.
 *
 * @remarks
 * Morning = kickoff, midday = reset, afternoon = citation (team/fun).
 */
const CATEGORY_TEMPLATE_MAP: Record<Category, MessageTemplate> = {
  motivation: 'kickoff',
  wellbeing: 'reset',
  focus: 'kickoff',
  team: 'citation',
  fun: 'direct',
};

/**
 * Formats a ContentItem into a Discord-ready message string.
 *
 * @param item - Content item to format
 * @param template - Optional template override (uses category default if omitted)
 *
 * @returns Formatted message string ready for Discord
 *
 * @remarks
 * For API items (provider === 'api'), adds author attribution if available via source.
 *
 * @example
 * ```typescript
 * // Local motivation item
 * formatMessage(motivationItem);
 * // "💪 Kick-off du jour\n\nChaque grand projet..."
 *
 * // API quote item
 * formatMessage(quoteItem);
 * // "💬 Citation du jour\n\n\"Il faut vouloir...\" — Albert Camus"
 * ```
 */
export function formatMessage(item: ContentItem, template?: MessageTemplate): string {
  const resolvedTemplate = template ?? CATEGORY_TEMPLATE_MAP[item.category];

  switch (resolvedTemplate) {
    case 'kickoff':
      return formatKickoff(item.text);

    case 'reset':
      return formatReset(item.text);

    case 'citation':
      return formatCitation(item.text, item.source);

    case 'direct':
    default:
      return item.text;
  }
}

/**
 * Formats a message with the kickoff template.
 *
 * @param text - Message text
 *
 * @returns Formatted kickoff message
 *
 * @example
 * ```typescript
 * formatKickoff('Chaque grand projet commence par une décision.');
 * // "💪 Kick-off du jour\n\nChaque grand projet commence par une décision."
 * ```
 */
export function formatKickoff(text: string): string {
  return `💪 **Kick-off du jour**\n\n${text}`;
}

/**
 * Formats a message with the reset template.
 *
 * @param text - Message text
 *
 * @returns Formatted reset message
 *
 * @example
 * ```typescript
 * formatReset('Prenez 5 minutes pour souffler.');
 * // "🌿 **Pause bien-être**\n\nPrenez 5 minutes pour souffler."
 * ```
 */
export function formatReset(text: string): string {
  return `🌿 **Pause bien-être**\n\n${text}`;
}

/**
 * Formats a message with the citation template.
 *
 * @param text - Quote text
 * @param source - Optional author/source attribution
 *
 * @returns Formatted citation message
 *
 * @example
 * ```typescript
 * formatCitation('La vie est belle.', 'Albert Camus');
 * // "💬 **Citation du jour**\n\n*\"La vie est belle.\"*\n\n— Albert Camus"
 *
 * formatCitation('Travaillez ensemble.');
 * // "💬 **Citation du jour**\n\n*\"Travaillez ensemble.\"*"
 * ```
 */
export function formatCitation(text: string, source?: string): string {
  const quotedText = `*"${text}"*`;
  const attribution = source ? `\n\n— ${source}` : '';
  return `💬 **Citation du jour**\n\n${quotedText}${attribution}`;
}

/**
 * Determines the appropriate template for a given category and time slot.
 *
 * @param category - Content category
 * @param timeSlot - Optional HH:MM time slot
 *
 * @returns Best matching template for the context
 *
 * @example
 * ```typescript
 * getTemplateForContext('motivation', '09:15'); // 'kickoff'
 * getTemplateForContext('wellbeing', '12:45');  // 'reset'
 * getTemplateForContext('team', '16:30');       // 'citation'
 * ```
 */
export function getTemplateForContext(
  category: Category,
  timeSlot?: string
): MessageTemplate {
  // Midday slot always uses reset template regardless of category
  if (timeSlot === '12:45') {
    return 'reset';
  }

  return CATEGORY_TEMPLATE_MAP[category];
}
