/**
 * Database Migrations
 *
 * Handles SQLite schema creation and versioning.
 * Migrations are idempotent and run automatically on startup.
 *
 * @remarks
 * Uses a simple migration system with a schema_version table.
 * Each migration is executed only once.
 *
 * @security
 * - No dynamic SQL construction
 * - All schema changes are explicit and reviewed
 *
 * @example
 * ```typescript
 * import { runMigrations } from '@/db/migrations';
 * import { getDatabase } from '@/db/db';
 *
 * const db = getDatabase();
 * runMigrations(db);
 * ```
 */

import type Database from 'better-sqlite3';

/**
 * Current schema version.
 *
 * @remarks
 * Increment this when adding new migrations.
 */
const CURRENT_VERSION = 1;

/**
 * Runs all pending database migrations.
 *
 * @param db - Database instance
 *
 * @remarks
 * - Creates schema_version table if it doesn't exist
 * - Executes migrations sequentially
 * - Updates version number after each migration
 * - Wrapped in transaction for atomicity
 *
 * @throws {Error} If migration fails
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 * runMigrations(db);
 * console.log('Migrations complete');
 * ```
 */
export function runMigrations(db: Database.Database): void {
  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get current version
  const versionRow = db
    .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;

  const currentVersion = versionRow?.version ?? 0;

  console.log(`📊 Database schema version: ${currentVersion}`);

  // Run migrations
  if (currentVersion < CURRENT_VERSION) {
    console.log(`🔄 Running migrations from v${currentVersion} to v${CURRENT_VERSION}...`);

    for (let version = currentVersion + 1; version <= CURRENT_VERSION; version++) {
      const migration = migrations[version];
      if (!migration) {
        throw new Error(`Migration v${version} not found`);
      }

      console.log(`  ⏩ Applying migration v${version}: ${migration.name}`);

      // Run migration in transaction
      const applyMigration = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
      });

      applyMigration();

      console.log(`  ✅ Migration v${version} applied`);
    }

    console.log(`✅ All migrations applied successfully`);
  } else {
    console.log(`✅ Database schema is up to date`);
  }
}

/**
 * Migration interface.
 */
interface Migration {
  /** Migration name/description */
  name: string;
  /** Apply migration */
  up: (db: Database.Database) => void;
  /** Rollback migration (optional) */
  down?: (db: Database.Database) => void;
}

/**
 * All migrations by version number.
 *
 * @remarks
 * Add new migrations here and increment CURRENT_VERSION.
 */
const migrations: Record<number, Migration> = {
  1: {
    name: 'Initial schema',
    up: (db) => {
      // Guild configuration table
      db.exec(`
        CREATE TABLE IF NOT EXISTS guild_config (
          guild_id TEXT PRIMARY KEY,
          channel_id TEXT NOT NULL,
          timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
          cadence INTEGER NOT NULL DEFAULT 2 CHECK (cadence IN (2, 3)),
          active_days TEXT NOT NULL DEFAULT '1,2,3,4,5',
          schedule_times TEXT NOT NULL DEFAULT '09:15,16:30',
          contextual_enabled INTEGER NOT NULL DEFAULT 0 CHECK (contextual_enabled IN (0, 1)),
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Sent messages table (for anti-repetition tracking)
      db.exec(`
        CREATE TABLE IF NOT EXISTS sent_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          content_id TEXT NOT NULL,
          category TEXT NOT NULL,
          provider TEXT NOT NULL CHECK (provider IN ('local', 'api', 'rss')),
          sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes for sent_messages
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sent_guild_date
        ON sent_messages (guild_id, sent_at DESC)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sent_content
        ON sent_messages (guild_id, content_id, sent_at DESC)
      `);

      // Cooldowns table (for rate limiting)
      db.exec(`
        CREATE TABLE IF NOT EXISTS cooldowns (
          key TEXT PRIMARY KEY,
          expires_at DATETIME NOT NULL
        )
      `);

      // Index for cooldowns cleanup
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_cooldowns_expires
        ON cooldowns (expires_at)
      `);

      console.log('    ✅ Created tables: guild_config, sent_messages, cooldowns');
    },
    down: (db) => {
      // Rollback: drop all tables
      db.exec('DROP TABLE IF EXISTS cooldowns');
      db.exec('DROP TABLE IF EXISTS sent_messages');
      db.exec('DROP TABLE IF EXISTS guild_config');
      console.log('    ✅ Dropped tables: guild_config, sent_messages, cooldowns');
    },
  },
};

/**
 * Rollback last migration (for development).
 *
 * @param db - Database instance
 *
 * @remarks
 * ⚠️ Use with caution! This will lose data.
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 * rollbackLastMigration(db);
 * ```
 */
export function rollbackLastMigration(db: Database.Database): void {
  const versionRow = db
    .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;

  if (!versionRow) {
    console.log('No migrations to rollback');
    return;
  }

  const version = versionRow.version;
  const migration = migrations[version];

  if (!migration?.down) {
    throw new Error(`Migration v${version} has no rollback function`);
  }

  console.log(`🔄 Rolling back migration v${version}...`);

  const rollback = db.transaction(() => {
    migration.down!(db);
    db.prepare('DELETE FROM schema_version WHERE version = ?').run(version);
  });

  rollback();

  console.log(`✅ Migration v${version} rolled back`);
}
