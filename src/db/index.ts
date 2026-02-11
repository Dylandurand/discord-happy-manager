/**
 * Database Module Exports
 *
 * Central export point for all database-related functionality.
 *
 * @example
 * ```typescript
 * import { getDatabase, guildConfigRepo, sentRepo, cooldownRepo } from '@/db';
 *
 * const db = getDatabase();
 * const config = guildConfigRepo.get('123456789');
 * ```
 */

export { getDatabase, closeDatabase, DatabaseError } from './db';
export { runMigrations, rollbackLastMigration } from './migrations';
export { guildConfigRepo } from './guildConfigRepo';
export { sentRepo } from './sentRepo';
export { cooldownRepo } from './cooldownRepo';
