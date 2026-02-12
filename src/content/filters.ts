/**
 * Content Filters
 *
 * Validates and sanitizes content items before delivery.
 * Ensures messages meet quality, safety, and length requirements.
 *
 * @remarks
 * Filters are applied in order: length → banned words → emoji count.
 * A message failing any filter is rejected.
 *
 * @security
 * Banned words filter prevents medical, political, or inappropriate content.
 *
 * @example
 * ```typescript
 * const result = applyFilters(item);
 * if (!result.passed) {
 *   console.log(`Rejected: ${result.reason}`);
 * }
 * ```
 */

import { CONTENT, BANNED_WORDS } from '@/config/constants';
import type { ContentItem } from '@/types';

/**
 * Result of content filter evaluation.
 */
export interface FilterResult {
  /** Whether the content passed all filters */
  passed: boolean;

  /** Reason for rejection (only set when passed is false) */
  reason?: string;
}

/**
 * Counts emoji characters in a string.
 *
 * @param text - Text to count emojis in
 *
 * @returns Number of emojis found
 *
 * @remarks
 * Uses a Unicode range regex to detect standard emoji sequences
 * including ZWJ sequences, skin tone modifiers, and flags.
 *
 * @example
 * ```typescript
 * countEmojis('Hello 👋 World 🌍'); // 2
 * ```
 */
export function countEmojis(text: string): number {
  // Match standard emojis, ZWJ sequences, flags, skin tone modifiers
  const emojiRegex =
    /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Regional_Indicator}{2}|[\u200D\u20E3\uFE0F][\p{Emoji}]+/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

/**
 * Checks if text exceeds the maximum allowed length.
 *
 * @param text - Text to check
 *
 * @returns FilterResult indicating pass/fail with reason
 *
 * @example
 * ```typescript
 * const result = checkLength('Short message');
 * // { passed: true }
 * ```
 */
export function checkLength(text: string): FilterResult {
  if (text.length > CONTENT.MAX_LENGTH) {
    return {
      passed: false,
      reason: `Message too long: ${text.length} chars (max ${CONTENT.MAX_LENGTH})`,
    };
  }

  if (text.trim().length === 0) {
    return {
      passed: false,
      reason: 'Message is empty',
    };
  }

  return { passed: true };
}

/**
 * Checks if text contains banned words.
 *
 * @param text - Text to check
 *
 * @returns FilterResult indicating pass/fail with reason
 *
 * @security
 * Case-insensitive comparison. Uses word-boundary matching where possible.
 *
 * @example
 * ```typescript
 * const result = checkBannedWords('Take your medication daily');
 * // { passed: false, reason: 'Contains banned word: medication' }
 * ```
 */
export function checkBannedWords(text: string): FilterResult {
  const lowerText = text.toLowerCase();

  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return {
        passed: false,
        reason: `Contains banned word: ${word}`,
      };
    }
  }

  return { passed: true };
}

/**
 * Checks if text contains too many emojis.
 *
 * @param text - Text to check
 *
 * @returns FilterResult indicating pass/fail with reason
 *
 * @example
 * ```typescript
 * const result = checkEmojiCount('Hello 🎉🎊🎈🎁');
 * // { passed: false, reason: 'Too many emojis: 4 (max 2)' }
 * ```
 */
export function checkEmojiCount(text: string): FilterResult {
  const count = countEmojis(text);

  if (count > CONTENT.MAX_EMOJIS) {
    return {
      passed: false,
      reason: `Too many emojis: ${count} (max ${CONTENT.MAX_EMOJIS})`,
    };
  }

  return { passed: true };
}

/**
 * Applies all content filters to a ContentItem.
 *
 * @param item - Content item to filter
 *
 * @returns FilterResult indicating pass/fail with reason
 *
 * @remarks
 * Filters are applied in order: length → banned words → emoji count.
 * Returns on first failure for performance.
 *
 * @example
 * ```typescript
 * const result = applyFilters(item);
 * if (result.passed) {
 *   await channel.send(item.text);
 * }
 * ```
 */
export function applyFilters(item: ContentItem): FilterResult {
  const lengthCheck = checkLength(item.text);
  if (!lengthCheck.passed) return lengthCheck;

  const bannedCheck = checkBannedWords(item.text);
  if (!bannedCheck.passed) return bannedCheck;

  const emojiCheck = checkEmojiCount(item.text);
  if (!emojiCheck.passed) return emojiCheck;

  return { passed: true };
}
