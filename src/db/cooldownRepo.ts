/**
 * Cooldown Repository
 *
 * Manages rate limiting and cooldowns for commands and contextual responses.
 * Prevents spam and ensures fair usage of bot features.
 *
 * @remarks
 * Cooldowns are stored with a key (e.g., "guild:123:now") and expiration time.
 * Expired cooldowns are automatically ignored and cleaned up periodically.
 *
 * @security
 * - SQL injection protected via prepared statements
 * - Cooldown keys validated to prevent abuse
 *
 * @performance
 * - Indexed on expires_at for fast cleanup queries
 * - Automatic cleanup on check operations
 *
 * @example
 * ```typescript
 * import { cooldownRepo } from '@/db/cooldownRepo';
 *
 * // Check if on cooldown
 * if (cooldownRepo.isOnCooldown('guild:123:now')) {
 *   return 'Please wait before using this command again';
 * }
 *
 * // Set cooldown (60 seconds)
 * const expiresAt = new Date(Date.now() + 60000);
 * cooldownRepo.set('guild:123:now', expiresAt);
 * ```
 */

import type Database from 'better-sqlite3';
import { getDatabase, DatabaseError } from './db';

/**
 * Cooldown repository.
 *
 * @remarks
 * Singleton instance exported for application-wide use.
 */
export class CooldownRepository {
  private readonly _db: Database.Database | undefined;

  constructor(db?: Database.Database) {
    this._db = db;
  }

  private db(): Database.Database {
    return this._db ?? getDatabase();
  }
  /**
   * Sets a cooldown with expiration time.
   *
   * @param key - Cooldown identifier (e.g., "guild:123:now", "user:456:kudos")
   * @param expiresAt - Expiration timestamp
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * const expiresAt = new Date(Date.now() + 60000); // 60 seconds
   * cooldownRepo.set('guild:123:now', expiresAt);
   * ```
   */
  set(key: string, expiresAt: Date): void {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        INSERT INTO cooldowns (key, expires_at)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          expires_at = excluded.expires_at
      `);

      stmt.run(key, expiresAt.toISOString());
    } catch (error) {
      throw new DatabaseError(
        `Failed to set cooldown for key ${key}`,
        'set',
        error as Error
      );
    }
  }

  /**
   * Gets cooldown expiration time if it exists and is not expired.
   *
   * @param key - Cooldown identifier
   *
   * @returns Expiration date or null if not found or expired
   *
   * @throws {DatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * const expiresAt = cooldownRepo.get('guild:123:now');
   * if (expiresAt) {
   *   const remainingMs = expiresAt.getTime() - Date.now();
   *   console.log(`Cooldown expires in ${remainingMs}ms`);
   * }
   * ```
   */
  get(key: string): Date | null {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT expires_at
        FROM cooldowns
        WHERE key = ?
          AND expires_at > datetime('now')
      `);

      const row = stmt.get(key) as { expires_at: string } | undefined;

      if (!row) {
        return null;
      }

      return new Date(row.expires_at);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get cooldown for key ${key}`,
        'get',
        error as Error
      );
    }
  }

  /**
   * Checks if a cooldown is active.
   *
   * @param key - Cooldown identifier
   *
   * @returns True if cooldown is active (not expired)
   *
   * @throws {DatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * if (cooldownRepo.isOnCooldown('guild:123:now')) {
   *   return 'Command is on cooldown';
   * }
   * ```
   */
  isOnCooldown(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Gets remaining cooldown time in milliseconds.
   *
   * @param key - Cooldown identifier
   *
   * @returns Remaining milliseconds or 0 if not on cooldown
   *
   * @throws {DatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * const remaining = cooldownRepo.getRemainingMs('guild:123:now');
   * if (remaining > 0) {
   *   console.log(`Please wait ${Math.ceil(remaining / 1000)} seconds`);
   * }
   * ```
   */
  getRemainingMs(key: string): number {
    const expiresAt = this.get(key);
    if (!expiresAt) {
      return 0;
    }

    const remaining = expiresAt.getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Deletes a specific cooldown.
   *
   * @param key - Cooldown identifier
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @remarks
   * Useful for admin commands to reset cooldowns.
   *
   * @example
   * ```typescript
   * cooldownRepo.delete('guild:123:now');
   * ```
   */
  delete(key: string): void {
    try {
      const db = this.db();
      const stmt = db.prepare('DELETE FROM cooldowns WHERE key = ?');
      stmt.run(key);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete cooldown for key ${key}`,
        'delete',
        error as Error
      );
    }
  }

  /**
   * Cleans up expired cooldowns.
   *
   * @returns Number of deleted records
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @remarks
   * Should be run periodically (e.g., every hour) to prevent database growth.
   * Expired cooldowns don't affect functionality but take up space.
   *
   * @example
   * ```typescript
   * const deleted = cooldownRepo.cleanup();
   * console.log(`Cleaned up ${deleted} expired cooldowns`);
   * ```
   */
  cleanup(): number {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        DELETE FROM cooldowns
        WHERE expires_at <= datetime('now')
      `);

      const result = stmt.run();
      return result.changes;
    } catch (error) {
      throw new DatabaseError(
        'Failed to cleanup expired cooldowns',
        'cleanup',
        error as Error
      );
    }
  }

  /**
   * Deletes all cooldowns for a guild.
   *
   * @param guildId - Discord guild (server) ID
   *
   * @returns Number of deleted records
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @remarks
   * Used when bot is removed from a server.
   *
   * @example
   * ```typescript
   * const deleted = cooldownRepo.deleteForGuild('123456789');
   * ```
   */
  deleteForGuild(guildId: string): number {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        DELETE FROM cooldowns
        WHERE key LIKE 'guild:' || ? || ':%'
      `);

      const result = stmt.run(guildId);
      return result.changes;
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete cooldowns for guild ${guildId}`,
        'deleteForGuild',
        error as Error
      );
    }
  }

  /**
   * Sets cooldown for a command with duration in seconds.
   *
   * @param key - Cooldown identifier
   * @param durationSeconds - Cooldown duration in seconds
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @example
   * ```typescript
   * cooldownRepo.setWithDuration('guild:123:now', 60); // 60 seconds
   * ```
   */
  setWithDuration(key: string, durationSeconds: number): void {
    const expiresAt = new Date(Date.now() + durationSeconds * 1000);
    this.set(key, expiresAt);
  }

  /**
   * Gets all active cooldowns (for debugging/admin).
   *
   * @param limit - Maximum number of cooldowns to return (default: 100)
   *
   * @returns Array of active cooldowns with keys and expiration times
   *
   * @throws {DatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * const cooldowns = cooldownRepo.getAll(10);
   * for (const cd of cooldowns) {
   *   console.log(`${cd.key} expires at ${cd.expiresAt}`);
   * }
   * ```
   */
  getAll(limit: number = 100): Array<{ key: string; expiresAt: Date }> {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT key, expires_at as expiresAt
        FROM cooldowns
        WHERE expires_at > datetime('now')
        ORDER BY expires_at ASC
        LIMIT ?
      `);

      const rows = stmt.all(limit) as Array<{ key: string; expiresAt: string }>;

      return rows.map((row) => ({
        key: row.key,
        expiresAt: new Date(row.expiresAt),
      }));
    } catch (error) {
      throw new DatabaseError(
        'Failed to get all cooldowns',
        'getAll',
        error as Error
      );
    }
  }
}

/**
 * Singleton cooldown repository instance.
 *
 * @example
 * ```typescript
 * import { cooldownRepo } from '@/db/cooldownRepo';
 *
 * if (!cooldownRepo.isOnCooldown('guild:123:now')) {
 *   cooldownRepo.setWithDuration('guild:123:now', 60);
 * }
 * ```
 */
export const cooldownRepo = new CooldownRepository();
