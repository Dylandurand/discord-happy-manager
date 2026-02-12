import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SentMessageRepository } from '@/db/sentRepo';
import { runMigrations } from '@/db/migrations';

let db: Database.Database;
let repo: SentMessageRepository;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  repo = new SentMessageRepository(db);
});

afterEach(() => {
  db.close();
});

const sampleMessage = {
  guildId: 'guild-001',
  channelId: 'channel-123',
  contentId: 'mot-001',
  category: 'motivation' as const,
  provider: 'local' as const,
  sentAt: new Date(),
};

describe('SentMessageRepository', () => {
  describe('record', () => {
    it('inserts a sent message without throwing', () => {
      expect(() => repo.record(sampleMessage)).not.toThrow();
    });
  });

  describe('wasSentRecently', () => {
    it('returns false when message was never sent', () => {
      expect(repo.wasSentRecently('guild-001', 'mot-001', 30)).toBe(false);
    });

    it('returns true after recording', () => {
      repo.record(sampleMessage);
      expect(repo.wasSentRecently('guild-001', 'mot-001', 30)).toBe(true);
    });

    it('returns false for different guild', () => {
      repo.record(sampleMessage);
      expect(repo.wasSentRecently('guild-999', 'mot-001', 30)).toBe(false);
    });

    it('returns false for different contentId', () => {
      repo.record(sampleMessage);
      expect(repo.wasSentRecently('guild-001', 'mot-002', 30)).toBe(false);
    });
  });

  describe('getRecent', () => {
    it('returns empty array when no messages', () => {
      expect(repo.getRecent('guild-001')).toEqual([]);
    });

    it('returns messages in desc order', () => {
      repo.record({ ...sampleMessage, contentId: 'mot-001', sentAt: new Date('2025-01-01') });
      repo.record({ ...sampleMessage, contentId: 'mot-002', sentAt: new Date('2025-01-02') });
      const results = repo.getRecent('guild-001');
      expect(results).toHaveLength(2);
      expect(results[0]!.contentId).toBe('mot-002'); // most recent first
    });

    it('respects limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        repo.record({ ...sampleMessage, contentId: `mot-00${i}` });
      }
      expect(repo.getRecent('guild-001', 3)).toHaveLength(3);
    });
  });

  describe('cleanup', () => {
    it('returns 0 when no old records', () => {
      repo.record(sampleMessage);
      expect(repo.cleanup(90)).toBe(0); // recent messages not deleted
    });

    it('deletes records older than specified days', () => {
      // Insert an "old" message manually
      db.prepare(`
        INSERT INTO sent_messages (guild_id, channel_id, content_id, category, provider, sent_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-100 days'))
      `).run('guild-001', 'ch', 'old-001', 'motivation', 'local');

      expect(repo.cleanup(90)).toBe(1);
    });
  });
});
