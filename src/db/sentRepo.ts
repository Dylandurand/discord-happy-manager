/**
 * Sent Messages Repository
 *
 * Tracks all messages sent by the bot for anti-repetition logic.
 * Prevents sending the same content within a configurable time window.
 *
 * @remarks
 * Each sent message is recorded with content_id, category, and timestamp.
 * Anti-repetition check queries last N days of messages per guild.
 *
 * @security
 * - SQL injection protected via prepared statements
 * - No sensitive data stored (only metadata)
 *
 * @performance
 * - Indexed on (guild_id, sent_at) for fast recent queries
 * - Indexed on (guild_id, content_id, sent_at) for anti-repetition checks
 * - Cleanup old records periodically to prevent unbounded growth
 *
 * @example
 * ```typescript
 * import { sentRepo } from '@/db/sentRepo';
 *
 * // Check if content was sent recently
 * const wasRecent = sentRepo.wasSentRecently('123456789', 'mot-001', 30);
 *
 * // Record a sent message
 * sentRepo.record({
 *   guildId: '123456789',
 *   channelId: '987654321',
 *   contentId: 'mot-001',
 *   category: 'motivation',
 *   provider: 'local',
 *   sentAt: new Date(),
 * });
 * ```
 */

import type Database from 'better-sqlite3';
import type { SentMessage, Category } from '@/types';
import { getDatabase, DatabaseError } from './db';

/**
 * Sent messages repository.
 *
 * @remarks
 * Accepts an optional Database instance for dependency injection (useful in tests).
 */
export class SentMessageRepository {
  private readonly _db: Database.Database | undefined;

  constructor(db?: Database.Database) {
    this._db = db;
  }

  private db(): Database.Database {
    return this._db ?? getDatabase();
  }
  /**
   * Records a sent message in the database.
   *
   * @param message - Sent message metadata
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * sentRepo.record({
   *   guildId: '123456789',
   *   channelId: '987654321',
   *   contentId: 'mot-001',
   *   category: 'motivation',
   *   provider: 'local',
   *   sentAt: new Date(),
   * });
   * ```
   */
  record(message: SentMessage): void {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        INSERT INTO sent_messages (
          guild_id,
          channel_id,
          content_id,
          category,
          provider,
          sent_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        message.guildId,
        message.channelId,
        message.contentId,
        message.category,
        message.provider,
        message.sentAt.toISOString()
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to record sent message for guild ${message.guildId}`,
        'record',
        error as Error
      );
    }
  }

  /**
   * Checks if a specific content was sent recently.
   *
   * @param guildId - Discord guild (server) ID
   * @param contentId - Content identifier
   * @param days - Number of days to look back (default: 30)
   *
   * @returns True if content was sent within the specified window
   *
   * @throws {DatabaseError} If database query fails
   *
   * @performance
   * Uses index idx_sent_content for fast lookup.
   *
   * @example
   * ```typescript
   * const wasRecent = sentRepo.wasSentRecently('123456789', 'mot-001', 30);
   * if (wasRecent) {
   *   console.log('This content was already sent recently');
   * }
   * ```
   */
  wasSentRecently(guildId: string, contentId: string, days: number = 30): boolean {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT 1
        FROM sent_messages
        WHERE guild_id = ?
          AND content_id = ?
          AND sent_at > datetime('now', '-' || ? || ' days')
        LIMIT 1
      `);

      const result = stmt.get(guildId, contentId, days);
      return result !== undefined;
    } catch (error) {
      throw new DatabaseError(
        `Failed to check if content ${contentId} was sent recently for guild ${guildId}`,
        'wasSentRecently',
        error as Error
      );
    }
  }

  /**
   * Gets recent messages for a guild.
   *
   * @param guildId - Discord guild (server) ID
   * @param limit - Maximum number of messages to return (default: 100)
   *
   * @returns Array of recent sent messages
   *
   * @throws {DatabaseError} If database query fails
   *
   * @performance
   * Uses index idx_sent_guild_date for fast sorting.
   *
   * @example
   * ```typescript
   * const recent = sentRepo.getRecent('123456789', 10);
   * console.log(`Last ${recent.length} messages sent`);
   * ```
   */
  getRecent(guildId: string, limit: number = 100): SentMessage[] {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT
          id,
          guild_id as guildId,
          channel_id as channelId,
          content_id as contentId,
          category,
          provider,
          sent_at as sentAt
        FROM sent_messages
        WHERE guild_id = ?
        ORDER BY sent_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(guildId, limit) as RawSentMessage[];

      return rows.map((row) => this.mapRowToMessage(row));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get recent messages for guild ${guildId}`,
        'getRecent',
        error as Error
      );
    }
  }

  /**
   * Gets message history by category.
   *
   * @param guildId - Discord guild (server) ID
   * @param category - Content category
   * @param limit - Maximum number of messages to return (default: 50)
   *
   * @returns Array of sent messages in the specified category
   *
   * @throws {DatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * const motivationMessages = sentRepo.getByCategory('123456789', 'motivation', 20);
   * ```
   */
  getByCategory(guildId: string, category: Category, limit: number = 50): SentMessage[] {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT
          id,
          guild_id as guildId,
          channel_id as channelId,
          content_id as contentId,
          category,
          provider,
          sent_at as sentAt
        FROM sent_messages
        WHERE guild_id = ?
          AND category = ?
        ORDER BY sent_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(guildId, category, limit) as RawSentMessage[];

      return rows.map((row) => this.mapRowToMessage(row));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get messages by category ${category} for guild ${guildId}`,
        'getByCategory',
        error as Error
      );
    }
  }

  /**
   * Cleans up old sent message records.
   *
   * @param days - Keep messages from last N days (default: 90)
   *
   * @returns Number of deleted records
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @remarks
   * Should be run periodically (e.g., daily) to prevent database growth.
   * Anti-repetition only needs 30 days, but we keep 90 for analytics.
   *
   * @example
   * ```typescript
   * const deleted = sentRepo.cleanup(90);
   * console.log(`Cleaned up ${deleted} old records`);
   * ```
   */
  cleanup(days: number = 90): number {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        DELETE FROM sent_messages
        WHERE sent_at < datetime('now', '-' || ? || ' days')
      `);

      const result = stmt.run(days);
      return result.changes;
    } catch (error) {
      throw new DatabaseError(
        'Failed to cleanup old sent messages',
        'cleanup',
        error as Error
      );
    }
  }

  /**
   * Gets count of messages sent by provider.
   *
   * @param guildId - Discord guild (server) ID
   * @param days - Number of days to look back (default: 30)
   *
   * @returns Object with counts per provider
   *
   * @throws {DatabaseError} If database query fails
   *
   * @remarks
   * Useful for analytics and monitoring.
   *
   * @example
   * ```typescript
   * const stats = sentRepo.getProviderStats('123456789', 30);
   * console.log(`Local: ${stats.local}, API: ${stats.api}`);
   * ```
   */
  getProviderStats(
    guildId: string,
    days: number = 30
  ): Record<'local' | 'api' | 'rss', number> {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT
          provider,
          COUNT(*) as count
        FROM sent_messages
        WHERE guild_id = ?
          AND sent_at > datetime('now', '-' || ? || ' days')
        GROUP BY provider
      `);

      const rows = stmt.all(guildId, days) as Array<{ provider: string; count: number }>;

      const stats: Record<'local' | 'api' | 'rss', number> = {
        local: 0,
        api: 0,
        rss: 0,
      };

      for (const row of rows) {
        if (row.provider === 'local' || row.provider === 'api' || row.provider === 'rss') {
          stats[row.provider] = row.count;
        }
      }

      return stats;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get provider stats for guild ${guildId}`,
        'getProviderStats',
        error as Error
      );
    }
  }

  /**
   * Maps database row to SentMessage object.
   *
   * @param row - Raw database row
   *
   * @returns Typed SentMessage object
   */
  private mapRowToMessage(row: RawSentMessage): SentMessage {
    return {
      id: row.id,
      guildId: row.guildId,
      channelId: row.channelId,
      contentId: row.contentId,
      category: row.category as Category,
      provider: row.provider as 'local' | 'api' | 'rss',
      sentAt: new Date(row.sentAt),
    };
  }
}

/**
 * Raw sent message row from database.
 */
interface RawSentMessage {
  id: number;
  guildId: string;
  channelId: string;
  contentId: string;
  category: string;
  provider: string;
  sentAt: string; // ISO date string
}

/**
 * Singleton sent message repository instance.
 *
 * @example
 * ```typescript
 * import { sentRepo } from '@/db/sentRepo';
 *
 * sentRepo.record({ ... });
 * ```
 */
export const sentRepo = new SentMessageRepository();
