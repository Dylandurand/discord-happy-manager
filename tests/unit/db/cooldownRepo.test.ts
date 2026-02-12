import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { CooldownRepository } from '@/db/cooldownRepo';
import { runMigrations } from '@/db/migrations';

let db: Database.Database;
let repo: CooldownRepository;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  repo = new CooldownRepository(db);
});

afterEach(() => {
  db.close();
});

describe('CooldownRepository', () => {
  describe('isOnCooldown', () => {
    it('returns false for unknown key', () => {
      expect(repo.isOnCooldown('guild:123:now')).toBe(false);
    });

    it('returns true after setWithDuration', () => {
      repo.setWithDuration('guild:123:now', 60);
      expect(repo.isOnCooldown('guild:123:now')).toBe(true);
    });

    it('returns false for a different key', () => {
      repo.setWithDuration('guild:123:now', 60);
      expect(repo.isOnCooldown('guild:999:now')).toBe(false);
    });
  });

  describe('getRemainingMs', () => {
    it('returns 0 for unknown key', () => {
      expect(repo.getRemainingMs('unknown')).toBe(0);
    });

    it('returns positive value while on cooldown', () => {
      repo.setWithDuration('guild:123:now', 60);
      const remaining = repo.getRemainingMs('guild:123:now');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60_000);
    });
  });

  describe('setWithDuration', () => {
    it('sets a cooldown that can be retrieved', () => {
      repo.setWithDuration('test-key', 120);
      expect(repo.isOnCooldown('test-key')).toBe(true);
    });
  });

  describe('delete', () => {
    it('removes an active cooldown', () => {
      repo.setWithDuration('guild:123:now', 60);
      repo.delete('guild:123:now');
      expect(repo.isOnCooldown('guild:123:now')).toBe(false);
    });

    it('does not throw for non-existent key', () => {
      expect(() => repo.delete('no-such-key')).not.toThrow();
    });
  });

  describe('deleteForGuild', () => {
    it('removes all cooldowns for a guild prefix', () => {
      repo.setWithDuration('guild:123:now', 60);
      repo.setWithDuration('guild:123:kudos', 300);
      repo.setWithDuration('guild:999:now', 60);
      repo.deleteForGuild('123'); // expects guild ID, not the full key prefix
      expect(repo.isOnCooldown('guild:123:now')).toBe(false);
      expect(repo.isOnCooldown('guild:123:kudos')).toBe(false);
      expect(repo.isOnCooldown('guild:999:now')).toBe(true); // Other guild untouched
    });
  });

  describe('cleanup', () => {
    it('removes expired cooldowns', () => {
      // Insert an already-expired cooldown directly
      db.prepare(
        `INSERT INTO cooldowns (key, expires_at) VALUES (?, datetime('now', '-1 second'))`
      ).run('expired-key');

      expect(repo.cleanup()).toBe(1);
      expect(repo.isOnCooldown('expired-key')).toBe(false);
    });

    it('does not remove active cooldowns', () => {
      repo.setWithDuration('active-key', 60);
      expect(repo.cleanup()).toBe(0);
      expect(repo.isOnCooldown('active-key')).toBe(true);
    });
  });
});
