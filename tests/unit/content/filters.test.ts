import { describe, it, expect } from 'vitest';
import {
  checkLength,
  checkBannedWords,
  checkEmojiCount,
  countEmojis,
  applyFilters,
} from '@/content/filters';
import type { ContentItem } from '@/types';

const makeItem = (text: string): ContentItem => ({
  id: 'test-001',
  category: 'motivation',
  text,
  provider: 'local',
});

describe('checkLength', () => {
  it('passes for a normal message', () => {
    expect(checkLength('Bonjour le monde')).toEqual({ passed: true });
  });

  it('fails when text exceeds 600 chars', () => {
    const longText = 'a'.repeat(601);
    const result = checkLength(longText);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('too long');
  });

  it('fails for empty string', () => {
    const result = checkLength('   ');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('passes at exactly 600 chars', () => {
    expect(checkLength('a'.repeat(600))).toEqual({ passed: true });
  });
});

describe('checkBannedWords', () => {
  it('passes clean text', () => {
    expect(checkBannedWords('Travaillez ensemble !')).toEqual({ passed: true });
  });

  it('fails when text contains a banned word (case-insensitive)', () => {
    const result = checkBannedWords('Take your MEDICATION daily');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('medication');
  });

  it('fails for another banned word', () => {
    const result = checkBannedWords('thoughts about suicide');
    expect(result.passed).toBe(false);
  });
});

describe('countEmojis', () => {
  it('returns 0 for plain text', () => {
    expect(countEmojis('Hello World')).toBe(0);
  });

  it('counts standard emojis', () => {
    expect(countEmojis('Hello 👋 World 🌍')).toBe(2);
  });

  it('counts a single emoji', () => {
    expect(countEmojis('🚀')).toBe(1);
  });
});

describe('checkEmojiCount', () => {
  it('passes with 0 emojis', () => {
    expect(checkEmojiCount('Plain text')).toEqual({ passed: true });
  });

  it('passes with exactly 2 emojis', () => {
    expect(checkEmojiCount('Hello 👋 World 🌍')).toEqual({ passed: true });
  });

  it('fails with 3 or more emojis', () => {
    const result = checkEmojiCount('🎉🎊🎈 trop d\'emojis');
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('Too many emojis');
  });
});

describe('applyFilters', () => {
  it('passes a valid content item', () => {
    const item = makeItem('Une belle motivation pour aujourd\'hui !');
    expect(applyFilters(item)).toEqual({ passed: true });
  });

  it('fails when text is too long', () => {
    const item = makeItem('x'.repeat(700));
    expect(applyFilters(item).passed).toBe(false);
  });

  it('fails when text contains banned words', () => {
    const item = makeItem('See your therapist today');
    expect(applyFilters(item).passed).toBe(false);
  });

  it('fails when text has too many emojis', () => {
    const item = makeItem('🎉🎊🎈 Super message');
    expect(applyFilters(item).passed).toBe(false);
  });

  it('checks in order: length first', () => {
    // Long text with banned word — length check should fire first
    const item = makeItem('x'.repeat(700) + ' suicide');
    const result = applyFilters(item);
    expect(result.passed).toBe(false);
    expect(result.reason).toContain('too long');
  });
});
