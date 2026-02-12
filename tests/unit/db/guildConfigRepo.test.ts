import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { GuildConfigRepository } from '@/db/guildConfigRepo';
import { runMigrations } from '@/db/migrations';

// Use in-memory SQLite for tests
let db: Database.Database;
let repo: GuildConfigRepository;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  repo = new GuildConfigRepository(db);
});

afterEach(() => {
  db.close();
});

const sampleConfig = {
  guildId: 'guild-001',
  channelId: 'channel-123',
  timezone: 'Europe/Paris',
  cadence: 2 as const,
  activeDays: [1, 2, 3, 4, 5],
  scheduleTimes: ['09:15', '16:30'],
  contextualEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GuildConfigRepository', () => {
  describe('get', () => {
    it('returns null for unknown guild', () => {
      expect(repo.get('unknown-guild')).toBeNull();
    });

    it('returns config after upsert', () => {
      repo.upsert(sampleConfig);
      const result = repo.get('guild-001');
      expect(result).not.toBeNull();
      expect(result?.guildId).toBe('guild-001');
      expect(result?.channelId).toBe('channel-123');
      expect(result?.timezone).toBe('Europe/Paris');
      expect(result?.cadence).toBe(2);
    });

    it('returns correct activeDays array', () => {
      repo.upsert(sampleConfig);
      const result = repo.get('guild-001');
      expect(result?.activeDays).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns correct scheduleTimes array', () => {
      repo.upsert(sampleConfig);
      const result = repo.get('guild-001');
      expect(result?.scheduleTimes).toEqual(['09:15', '16:30']);
    });
  });

  describe('upsert', () => {
    it('inserts a new config', () => {
      repo.upsert(sampleConfig);
      expect(repo.get('guild-001')).not.toBeNull();
    });

    it('updates an existing config', () => {
      repo.upsert(sampleConfig);
      repo.upsert({ ...sampleConfig, channelId: 'new-channel', updatedAt: new Date() });
      const result = repo.get('guild-001');
      expect(result?.channelId).toBe('new-channel');
    });

    it('persists contextualEnabled = true', () => {
      repo.upsert({ ...sampleConfig, contextualEnabled: true });
      const result = repo.get('guild-001');
      expect(result?.contextualEnabled).toBe(true);
    });
  });

  describe('getAll', () => {
    it('returns empty array when no configs exist', () => {
      expect(repo.getAll()).toEqual([]);
    });

    it('returns all configs', () => {
      repo.upsert(sampleConfig);
      repo.upsert({ ...sampleConfig, guildId: 'guild-002', channelId: 'ch-002' });
      expect(repo.getAll()).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('removes the config', () => {
      repo.upsert(sampleConfig);
      repo.delete('guild-001');
      expect(repo.get('guild-001')).toBeNull();
    });

    it('does not throw for non-existent guild', () => {
      expect(() => repo.delete('no-such-guild')).not.toThrow();
    });
  });
});
