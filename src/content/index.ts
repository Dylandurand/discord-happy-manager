/**
 * Content Module Exports
 *
 * Central export point for the content system.
 *
 * @example
 * ```typescript
 * import { getFormattedContent, recordSentContent } from '@/content';
 * ```
 */

export { getFormattedContent, getContentItem, recordSentContent } from './provider';
export type { GetContentOptions, ContentResult } from './provider';

export { LocalPackProvider, getLocalPackProvider, ContentNotFoundError } from './localPackProvider';
export { QuoteApiProvider, getQuoteApiProvider, ApiProviderError } from './quoteApiProvider';

export { applyFilters, checkLength, checkBannedWords, checkEmojiCount, countEmojis } from './filters';
export type { FilterResult } from './filters';

export { formatMessage, formatKickoff, formatReset, formatCitation, getTemplateForContext } from './formatter';
export type { MessageTemplate } from './formatter';
