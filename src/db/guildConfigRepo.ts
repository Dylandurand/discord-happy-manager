/**
 * Guild Configuration Repository
 *
 * Manages guild-specific configuration in the database.
 * Each Discord server (guild) has its own configuration for scheduling,
 * channels, and bot behavior.
 *
 * @remarks
 * All methods use prepared statements for performance and security.
 * Configuration is cached in memory (see cache implementation in separate module).
 *
 * @security
 * - SQL injection protected via prepared statements
 * - Guild IDs validated before queries
 *
 * @performance
 * - Prepared statements cached by better-sqlite3
 * - Indexes on guild_id (primary key)
 *
 * @example
 * ```typescript
 * import { guildConfigRepo } from '@/db/guildConfigRepo';
 *
 * // Get config
 * const config = guildConfigRepo.get('123456789');
 *
 * // Create or update
 * guildConfigRepo.upsert({
 *   guildId: '123456789',
 *   channelId: '987654321',
 *   timezone: 'Europe/Paris',
 *   cadence: 2,
 *   activeDays: [1, 2, 3, 4, 5],
 *   scheduleTimes: ['09:15', '16:30'],
 *   contextualEnabled: false,
 * });
 * ```
 */

import type Database from 'better-sqlite3';
import type { GuildConfig } from '@/types';
import { getDatabase, DatabaseError } from './db';

/**
 * Guild configuration repository.
 *
 * @remarks
 * Accepts an optional Database instance for dependency injection (useful in tests).
 * Falls back to the application singleton when no db is provided.
 */
export class GuildConfigRepository {
  private readonly _db: Database.Database | undefined;

  constructor(db?: Database.Database) {
    this._db = db;
  }

  private db(): Database.Database {
    return this._db ?? getDatabase();
  }
  /**
   * Gets guild configuration by guild ID.
   *
   * @param guildId - Discord guild (server) ID
   *
   * @returns Guild configuration or null if not found
   *
   * @throws {DatabaseError} If database query fails
   *
   * @example
   * ```typescript
   * const config = guildConfigRepo.get('123456789');
   * if (config) {
   *   console.log(`Channel: ${config.channelId}`);
   * }
   * ```
   */
  get(guildId: string): GuildConfig | null {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT
          guild_id as guildId,
          channel_id as channelId,
          timezone,
          cadence,
          active_days as activeDays,
          schedule_times as scheduleTimes,
          contextual_enabled as contextualEnabled,
          created_at as createdAt,
          updated_at as updatedAt
        FROM guild_config
        WHERE guild_id = ?
      `);

      const row = stmt.get(guildId) as RawGuildConfig | undefined;

      if (!row) {
        return null;
      }

      return this.mapRowToConfig(row);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get guild config for ${guildId}`,
        'get',
        error as Error
      );
    }
  }

  /**
   * Gets all active guild configurations.
   *
   * @returns Array of all guild configurations
   *
   * @throws {DatabaseError} If database query fails
   *
   * @remarks
   * Used by scheduler to iterate over all guilds.
   *
   * @example
   * ```typescript
   * const configs = guildConfigRepo.getAll();
   * for (const config of configs) {
   *   console.log(`Guild: ${config.guildId}`);
   * }
   * ```
   */
  getAll(): GuildConfig[] {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        SELECT
          guild_id as guildId,
          channel_id as channelId,
          timezone,
          cadence,
          active_days as activeDays,
          schedule_times as scheduleTimes,
          contextual_enabled as contextualEnabled,
          created_at as createdAt,
          updated_at as updatedAt
        FROM guild_config
        ORDER BY guild_id
      `);

      const rows = stmt.all() as RawGuildConfig[];

      return rows.map((row) => this.mapRowToConfig(row));
    } catch (error) {
      throw new DatabaseError(
        'Failed to get all guild configs',
        'getAll',
        error as Error
      );
    }
  }

  /**
   * Creates or updates guild configuration.
   *
   * @param config - Guild configuration (without timestamps)
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @remarks
   * - If config exists: updates all fields except created_at
   * - If config doesn't exist: creates new record
   * - Uses UPSERT (INSERT OR REPLACE) for simplicity
   *
   * @example
   * ```typescript
   * guildConfigRepo.upsert({
   *   guildId: '123456789',
   *   channelId: '987654321',
   *   timezone: 'Europe/Paris',
   *   cadence: 2,
   *   activeDays: [1, 2, 3, 4, 5],
   *   scheduleTimes: ['09:15', '16:30'],
   *   contextualEnabled: false,
   *   createdAt: new Date(),
   *   updatedAt: new Date(),
   * });
   * ```
   */
  upsert(config: GuildConfig): void {
    try {
      const db = this.db();
      const stmt = db.prepare(`
        INSERT INTO guild_config (
          guild_id,
          channel_id,
          timezone,
          cadence,
          active_days,
          schedule_times,
          contextual_enabled,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(guild_id) DO UPDATE SET
          channel_id = excluded.channel_id,
          timezone = excluded.timezone,
          cadence = excluded.cadence,
          active_days = excluded.active_days,
          schedule_times = excluded.schedule_times,
          contextual_enabled = excluded.contextual_enabled,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        config.guildId,
        config.channelId,
        config.timezone,
        config.cadence,
        config.activeDays.join(','),
        config.scheduleTimes.join(','),
        config.contextualEnabled ? 1 : 0
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to upsert guild config for ${config.guildId}`,
        'upsert',
        error as Error
      );
    }
  }

  /**
   * Deletes guild configuration.
   *
   * @param guildId - Discord guild (server) ID
   *
   * @throws {DatabaseError} If database operation fails
   *
   * @remarks
   * Used when bot is removed from a server.
   *
   * @example
   * ```typescript
   * guildConfigRepo.delete('123456789');
   * ```
   */
  delete(guildId: string): void {
    try {
      const db = this.db();
      const stmt = db.prepare('DELETE FROM guild_config WHERE guild_id = ?');
      stmt.run(guildId);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete guild config for ${guildId}`,
        'delete',
        error as Error
      );
    }
  }

  /**
   * Maps database row to GuildConfig object.
   *
   * @param row - Raw database row
   *
   * @returns Typed GuildConfig object
   *
   * @remarks
   * Handles type conversion from SQLite types to TypeScript types:
   * - Comma-separated strings → arrays
   * - Integer booleans → boolean
   * - ISO date strings → Date objects
   */
  private mapRowToConfig(row: RawGuildConfig): GuildConfig {
    return {
      guildId: row.guildId,
      channelId: row.channelId,
      timezone: row.timezone,
      cadence: row.cadence as 2 | 3,
      activeDays: row.activeDays.split(',').map(Number),
      scheduleTimes: row.scheduleTimes.split(','),
      contextualEnabled: row.contextualEnabled === 1,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}

/**
 * Raw guild config row from database.
 *
 * @remarks
 * Intermediate type before mapping to GuildConfig.
 */
interface RawGuildConfig {
  guildId: string;
  channelId: string;
  timezone: string;
  cadence: number;
  activeDays: string; // Comma-separated
  scheduleTimes: string; // Comma-separated
  contextualEnabled: number; // 0 or 1
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Singleton guild config repository instance.
 *
 * @remarks
 * Import and use this instance throughout the application.
 *
 * @example
 * ```typescript
 * import { guildConfigRepo } from '@/db/guildConfigRepo';
 *
 * const config = guildConfigRepo.get('123456789');
 * ```
 */
export const guildConfigRepo = new GuildConfigRepository();
