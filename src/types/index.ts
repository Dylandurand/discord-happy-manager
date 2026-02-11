/**
 * Global Type Definitions
 *
 * Shared TypeScript types and interfaces used across the application.
 *
 * @remarks
 * This file exports all common types to maintain consistency.
 * Domain-specific types should be defined in their respective modules.
 */

import type { Category } from '@/config/constants';

/**
 * Content item from a provider (local or API).
 *
 * @remarks
 * Represents a single message with metadata for tracking and filtering.
 */
export interface ContentItem {
  /** Unique identifier for this content (used for anti-repetition) */
  id: string;

  /** Content category */
  category: Category;

  /** Message text (max 600 chars after filtering) */
  text: string;

  /** Optional tags for filtering/searching */
  tags?: string[];

  /** Original source URL or identifier */
  source?: string;

  /** Provider that generated this content */
  provider: 'local' | 'api' | 'rss';
}

/**
 * Guild-specific configuration stored in database.
 *
 * @remarks
 * Each Discord server (guild) has its own configuration.
 * All fields except guildId can be updated via /happy settings command.
 */
export interface GuildConfig {
  /** Discord guild (server) ID */
  guildId: string;

  /** Target channel ID for messages */
  channelId: string;

  /** Timezone for scheduling (IANA format) */
  timezone: string;

  /** Number of messages per day (2 or 3) */
  cadence: 2 | 3;

  /** Active days of week (1=Mon, 7=Sun) */
  activeDays: number[];

  /** Schedule times in HH:MM format */
  scheduleTimes: string[];

  /** Whether contextual mode is enabled */
  contextualEnabled: boolean;

  /** Configuration created timestamp */
  createdAt: Date;

  /** Configuration last updated timestamp */
  updatedAt: Date;
}

/**
 * Record of a sent message (for anti-repetition tracking).
 *
 * @remarks
 * Stored in database to prevent re-sending same content within 30 days.
 */
export interface SentMessage {
  /** Auto-increment ID */
  id?: number;

  /** Guild where message was sent */
  guildId: string;

  /** Channel where message was sent */
  channelId: string;

  /** Content ID (references ContentItem.id) */
  contentId: string;

  /** Content category */
  category: Category;

  /** Provider that generated the content */
  provider: 'local' | 'api' | 'rss';

  /** Timestamp when message was sent */
  sentAt: Date;
}

/**
 * Cooldown key-value pair.
 *
 * @remarks
 * Used for rate-limiting commands and contextual responses.
 * Key format examples:
 * - "guild:123456789:now" (command cooldown)
 * - "guild:123456789:context" (contextual response cooldown)
 * - "user:987654321:kudos" (user-specific cooldown)
 */
export interface Cooldown {
  /** Cooldown identifier key */
  key: string;

  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * Content provider interface.
 *
 * @remarks
 * All content providers (Local, API, RSS) must implement this interface.
 *
 * @example
 * ```typescript
 * class LocalPackProvider implements ContentProvider {
 *   async getItem(category?: Category): Promise<ContentItem> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export interface ContentProvider {
  /**
   * Retrieves a content item, optionally filtered by category.
   *
   * @param category - Optional category filter
   * @returns Content item
   *
   * @throws {ContentNotFoundError} If no content available
   */
  getItem(category?: Category): Promise<ContentItem>;
}

/**
 * Time slot for scheduled messages.
 *
 * @remarks
 * Represents a scheduled time in HH:MM format.
 * Examples: "09:15", "16:30"
 */
export type TimeSlot = string;

/**
 * Log level for application logging.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Environment type.
 */
export type Environment = 'development' | 'production' | 'test';

/**
 * Result type for operations that can fail.
 *
 * @template T - Success value type
 * @template E - Error type (defaults to Error)
 *
 * @remarks
 * Discriminated union for type-safe error handling.
 *
 * @example
 * ```typescript
 * function getContent(): Result<ContentItem> {
 *   try {
 *     return { success: true, data: item };
 *   } catch (error) {
 *     return { success: false, error: error as Error };
 *   }
 * }
 *
 * const result = getContent();
 * if (result.success) {
 *   console.log(result.data.text);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
