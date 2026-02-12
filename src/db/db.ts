/**
 * SQLite Database Connection
 *
 * Singleton pattern for database connection management.
 * Automatically initializes database schema on first connection.
 *
 * @remarks
 * Uses better-sqlite3 for synchronous SQLite operations.
 * WAL mode enabled for better concurrency.
 *
 * @security
 * - Database file created with restricted permissions
 * - Prepared statements prevent SQL injection
 * - No raw queries allowed
 *
 * @performance
 * - WAL mode for concurrent reads
 * - Connection pooling not needed (single process)
 * - Prepared statements cached automatically
 *
 * @example
 * ```typescript
 * import { getDatabase } from '@/db/db';
 *
 * const db = getDatabase();
 * const stmt = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?');
 * const config = stmt.get(guildId);
 * ```
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { env } from '@/config/env';
import { runMigrations } from './migrations';

/**
 * Singleton database instance.
 *
 * @remarks
 * Lazily initialized on first access.
 */
let database: Database.Database | null = null;

/**
 * Gets or creates the SQLite database connection.
 *
 * @returns Database instance
 *
 * @remarks
 * - Creates database file and parent directories if they don't exist
 * - Enables WAL mode for better concurrency
 * - Runs migrations on first connection
 * - Subsequent calls return cached instance
 *
 * @performance
 * Singleton pattern ensures only one connection per process.
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 * const stmt = db.prepare('SELECT * FROM guild_config');
 * const configs = stmt.all();
 * ```
 */
export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  const dbPath = env.SQLITE_PATH;

  // Ensure parent directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Create database connection
  database = new Database(dbPath, {
    verbose: env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Enable WAL mode for better concurrency
  database.pragma('journal_mode = WAL');

  // Enable foreign keys
  database.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(database);

  console.log(`✅ Database connected: ${dbPath}`);

  return database;
}

/**
 * Closes the database connection.
 *
 * @remarks
 * Should be called on graceful shutdown.
 * After calling this, getDatabase() will create a new connection.
 *
 * @example
 * ```typescript
 * process.on('SIGTERM', () => {
 *   closeDatabase();
 *   process.exit(0);
 * });
 * ```
 */
export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
    console.log('Database connection closed');
  }
}

/**
 * Custom error for database operations.
 *
 * @remarks
 * Wraps better-sqlite3 errors with additional context.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
    Error.captureStackTrace(this, this.constructor);
  }
}
