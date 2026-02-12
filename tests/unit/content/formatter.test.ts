import { describe, it, expect } from 'vitest';
import {
  formatKickoff,
  formatReset,
  formatCitation,
  formatMessage,
  getTemplateForContext,
} from '@/content/formatter';
import type { ContentItem } from '@/types';

const makeItem = (category: ContentItem['category'], text = 'Message test'): ContentItem => ({
  id: 'test-001',
  category,
  text,
  provider: 'local',
});

describe('formatKickoff', () => {
  it('wraps text with kickoff header', () => {
    const result = formatKickoff('Du courage !');
    expect(result).toContain('💪');
    expect(result).toContain('Kick-off du jour');
    expect(result).toContain('Du courage !');
  });
});

describe('formatReset', () => {
  it('wraps text with reset header', () => {
    const result = formatReset('Prenez une pause.');
    expect(result).toContain('🌿');
    expect(result).toContain('Pause bien-être');
    expect(result).toContain('Prenez une pause.');
  });
});

describe('formatCitation', () => {
  it('wraps text as a quoted citation', () => {
    const result = formatCitation('La vie est belle.');
    expect(result).toContain('💬');
    expect(result).toContain('Citation du jour');
    expect(result).toContain('"La vie est belle."');
  });

  it('includes attribution when source is provided', () => {
    const result = formatCitation('Agir c\'est vivre.', 'Albert Camus');
    expect(result).toContain('— Albert Camus');
  });

  it('omits attribution when source is undefined', () => {
    const result = formatCitation('Agir c\'est vivre.');
    expect(result).not.toContain('—');
  });
});

describe('formatMessage', () => {
  it('uses kickoff template for motivation', () => {
    const item = makeItem('motivation');
    const result = formatMessage(item);
    expect(result).toContain('💪');
  });

  it('uses reset template for wellbeing', () => {
    const item = makeItem('wellbeing');
    const result = formatMessage(item);
    expect(result).toContain('🌿');
  });

  it('uses citation template for team', () => {
    const item = makeItem('team');
    const result = formatMessage(item);
    expect(result).toContain('💬');
  });

  it('returns plain text for fun', () => {
    const item = makeItem('fun', 'Blague du jour');
    const result = formatMessage(item);
    expect(result).toBe('Blague du jour');
  });

  it('respects explicit template override', () => {
    const item = makeItem('motivation');
    const result = formatMessage(item, 'citation');
    expect(result).toContain('💬');
  });
});

describe('getTemplateForContext', () => {
  it('returns reset for 12:45 slot regardless of category', () => {
    expect(getTemplateForContext('motivation', '12:45')).toBe('reset');
    expect(getTemplateForContext('team', '12:45')).toBe('reset');
  });

  it('returns kickoff for motivation category', () => {
    expect(getTemplateForContext('motivation', '09:15')).toBe('kickoff');
  });

  it('returns citation for team category', () => {
    expect(getTemplateForContext('team', '16:30')).toBe('citation');
  });

  it('returns correct template with no slot', () => {
    expect(getTemplateForContext('focus')).toBe('kickoff');
    expect(getTemplateForContext('wellbeing')).toBe('reset');
  });
});
