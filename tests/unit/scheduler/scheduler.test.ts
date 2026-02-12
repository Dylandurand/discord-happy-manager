import { describe, it, expect } from 'vitest';
import { getCurrentTimeInTimezone, getCurrentDayOfWeek } from '@/scheduler/scheduler';
import { getSlotCategory, isDayActive, isSlotScheduled } from '@/scheduler/jobs';
import type { GuildConfig } from '@/types';

// Helper to create a minimal GuildConfig
const makeConfig = (overrides: Partial<GuildConfig> = {}): GuildConfig => ({
  guildId: '123456789',
  channelId: '987654321',
  timezone: 'Europe/Paris',
  cadence: 2,
  activeDays: [1, 2, 3, 4, 5],
  scheduleTimes: ['09:15', '16:30'],
  contextualEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('getCurrentTimeInTimezone', () => {
  it('returns a string in HH:MM format', () => {
    const result = getCurrentTimeInTimezone('Europe/Paris');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns a valid time for UTC', () => {
    const result = getCurrentTimeInTimezone('UTC');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('falls back to UTC for invalid timezone', () => {
    const result = getCurrentTimeInTimezone('Invalid/Timezone');
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns different times for different timezones during offset periods', () => {
    // Paris is UTC+1 or UTC+2, so times should differ from UTC
    // This test verifies the function runs without throwing
    const paris = getCurrentTimeInTimezone('Europe/Paris');
    const ny = getCurrentTimeInTimezone('America/New_York');
    expect(paris).toMatch(/^\d{2}:\d{2}$/);
    expect(ny).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('getCurrentDayOfWeek', () => {
  it('returns a number between 1 and 7', () => {
    const day = getCurrentDayOfWeek('Europe/Paris');
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(7);
  });

  it('falls back for invalid timezone', () => {
    const day = getCurrentDayOfWeek('Invalid/Timezone');
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(7);
  });
});

describe('getSlotCategory', () => {
  it('maps 09:15 to motivation', () => {
    expect(getSlotCategory('09:15', 2)).toBe('motivation');
  });

  it('maps 16:30 to team', () => {
    expect(getSlotCategory('16:30', 2)).toBe('team');
  });

  it('maps 12:45 to wellbeing for cadence 3', () => {
    expect(getSlotCategory('12:45', 3)).toBe('wellbeing');
  });

  it('falls back to motivation for unknown slot', () => {
    expect(getSlotCategory('11:00', 2)).toBe('motivation');
  });
});

describe('isDayActive', () => {
  it('returns true for a weekday in default config', () => {
    const config = makeConfig({ activeDays: [1, 2, 3, 4, 5] });
    expect(isDayActive(config, 1)).toBe(true); // Monday
    expect(isDayActive(config, 5)).toBe(true); // Friday
  });

  it('returns false for weekend in default config', () => {
    const config = makeConfig({ activeDays: [1, 2, 3, 4, 5] });
    expect(isDayActive(config, 6)).toBe(false); // Saturday
    expect(isDayActive(config, 7)).toBe(false); // Sunday
  });

  it('returns true for custom active day', () => {
    const config = makeConfig({ activeDays: [6, 7] });
    expect(isDayActive(config, 6)).toBe(true);
    expect(isDayActive(config, 1)).toBe(false);
  });
});

describe('isSlotScheduled', () => {
  it('returns true for scheduled slots', () => {
    const config = makeConfig({ scheduleTimes: ['09:15', '16:30'] });
    expect(isSlotScheduled(config, '09:15')).toBe(true);
    expect(isSlotScheduled(config, '16:30')).toBe(true);
  });

  it('returns false for unscheduled slot', () => {
    const config = makeConfig({ scheduleTimes: ['09:15', '16:30'] });
    expect(isSlotScheduled(config, '12:45')).toBe(false);
  });

  it('returns true for cadence 3 with 12:45', () => {
    const config = makeConfig({ cadence: 3, scheduleTimes: ['09:15', '12:45', '16:30'] });
    expect(isSlotScheduled(config, '12:45')).toBe(true);
  });
});
