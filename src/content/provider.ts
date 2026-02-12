/**
 * Content Provider Orchestrator
 *
 * Unified entry point for all content retrieval.
 * Tries providers in priority order with automatic fallback.
 *
 * @remarks
 * Priority order: API → Local Pack
 * If the API fails (timeout, error), falls back to LocalPackProvider.
 * This ensures content is always available even when external APIs are down.
 *
 * After retrieval, the message is formatted using the formatter module
 * and recorded in the sent_messages table for anti-repetition tracking.
 *
 * @example
 * ```typescript
 * const message = await getFormattedContent({
 *   guildId: '123456789',
 *   category: 'motivation',
 *   timeSlot: '09:15',
 * });
 * await channel.send(message);
 * ```
 */

import type { ContentItem } from '@/types';
import type { Category } from '@/config/constants';
import { sentRepo } from '@/db';
import { getLocalPackProvider } from './localPackProvider';
import { getQuoteApiProvider, ApiProviderError } from './quoteApiProvider';
import { formatMessage, getTemplateForContext } from './formatter';

/**
 * Options for content retrieval.
 */
export interface GetContentOptions {
  /** Guild ID for anti-repetition tracking */
  guildId: string;

  /** Optional category filter */
  category?: Category;

  /** Optional time slot for template selection (HH:MM) */
  timeSlot?: string;

  /** Skip API and use local pack directly */
  localOnly?: boolean;
}

/**
 * Result of a content retrieval operation.
 */
export interface ContentResult {
  /** Formatted message string ready for Discord */
  message: string;

  /** Raw content item for tracking/logging */
  item: ContentItem;
}

/**
 * Retrieves formatted content for a guild with full fallback chain.
 *
 * @param options - Retrieval options
 *
 * @returns Promise resolving to a ContentResult
 *
 * @throws {ContentNotFoundError} If neither API nor local pack can provide content
 *
 * @remarks
 * Records the sent message in the database for anti-repetition tracking.
 *
 * @example
 * ```typescript
 * const result = await getFormattedContent({
 *   guildId: '123456789',
 *   category: 'motivation',
 *   timeSlot: '09:15',
 * });
 * await channel.send(result.message);
 * ```
 */
export async function getFormattedContent(options: GetContentOptions): Promise<ContentResult> {
  const { guildId, category, timeSlot, localOnly = false } = options;

  const item = await getContentItem({ guildId, category, localOnly });

  const template = getTemplateForContext(item.category, timeSlot);
  const message = formatMessage(item, template);

  // Record the sent message for anti-repetition tracking
  sentRepo.record({
    guildId,
    channelId: '', // Will be updated by caller if needed
    contentId: item.id,
    category: item.category,
    provider: item.provider,
    sentAt: new Date(),
  });

  return { message, item };
}

/**
 * Retrieves a raw ContentItem with fallback chain (no formatting, no recording).
 *
 * @param options - Retrieval options
 *
 * @returns Promise resolving to a ContentItem
 *
 * @throws {ContentNotFoundError} If no content is available
 *
 * @example
 * ```typescript
 * const item = await getContentItem({ guildId: '123', category: 'motivation' });
 * ```
 */
export async function getContentItem(
  options: Pick<GetContentOptions, 'guildId' | 'category' | 'localOnly'>
): Promise<ContentItem> {
  const { guildId, category, localOnly = false } = options;

  // Try API first (unless localOnly requested)
  if (!localOnly) {
    try {
      const apiProvider = getQuoteApiProvider();
      const item = await apiProvider.getItem(category);
      return item;
    } catch (error) {
      // API failed — log and fall through to local pack
      if (!(error instanceof ApiProviderError)) {
        console.error('[ContentProvider] Unexpected API error:', error);
      }
      // Silent fallback to local pack
    }
  }

  // Fallback to local pack
  const localProvider = getLocalPackProvider();
  return localProvider.getItem(category, guildId);
}

/**
 * Records a sent content item in the database.
 *
 * @param guildId - Guild ID
 * @param channelId - Channel ID
 * @param item - Content item that was sent
 *
 * @remarks
 * Called after successfully delivering a message to Discord.
 * Decoupled from getFormattedContent to allow callers to record
 * after confirmed delivery.
 *
 * @example
 * ```typescript
 * await channel.send(result.message);
 * recordSentContent('123456789', channelId, result.item);
 * ```
 */
export function recordSentContent(
  guildId: string,
  channelId: string,
  item: ContentItem
): void {
  sentRepo.record({
    guildId,
    channelId,
    contentId: item.id,
    category: item.category,
    provider: item.provider,
    sentAt: new Date(),
  });
}
