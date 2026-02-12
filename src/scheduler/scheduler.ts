/**
 * Cron Scheduler
 *
 * Runs a minute-by-minute check to send scheduled messages across all guilds.
 * Supports per-guild timezone configuration.
 *
 * @remarks
 * Strategy:
 * - Cron fires every minute: `* * * * *`
 * - For each guild, converts current UTC time to guild's timezone
 * - If current HH:MM matches a scheduled slot AND the day is active → send
 * - Slot cooldown (90s) prevents double-sends at minute boundaries
 *
 * Timezone handling uses the Node.js built-in `Intl.DateTimeFormat` API,
 * requiring no additional dependencies.
 *
 * @example
 * ```typescript
 * startScheduler();
 * // Bot now sends messages at configured times automatically.
 *
 * stopScheduler();
 * // Cron job stopped cleanly.
 * ```
 */

import cron from 'node-cron';
import { guildConfigRepo } from '@/db';
import { sendScheduledMessage, isDayActive, isSlotScheduled } from './jobs';

/**
 * Active cron task reference (for graceful shutdown).
 */
let schedulerTask: cron.ScheduledTask | null = null;

/**
 * Gets the current HH:MM time in a given IANA timezone.
 *
 * @param timezone - IANA timezone string (e.g., 'Europe/Paris')
 *
 * @returns Time string in HH:MM format
 *
 * @remarks
 * Uses `Intl.DateTimeFormat` with the `hour12: false` option.
 * Falls back to UTC if the timezone is invalid.
 *
 * @example
 * ```typescript
 * getCurrentTimeInTimezone('Europe/Paris'); // "09:15"
 * getCurrentTimeInTimezone('America/New_York'); // "03:15"
 * ```
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';

    // Normalize "24:xx" to "00:xx" (edge case with some Intl implementations)
    const normalizedHour = hour === '24' ? '00' : hour;

    return `${normalizedHour}:${minute}`;
  } catch {
    // Invalid timezone — fall back to UTC
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Gets the current ISO day of week in a given timezone.
 *
 * @param timezone - IANA timezone string
 *
 * @returns Day of week (1=Monday, 7=Sunday, ISO 8601)
 *
 * @example
 * ```typescript
 * getCurrentDayOfWeek('Europe/Paris'); // 1 (Monday)
 * ```
 */
export function getCurrentDayOfWeek(timezone: string): number {
  try {
    const now = new Date();

    // Get locale weekday number (0=Sun, 1=Mon, ..., 6=Sat) in target timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).formatToParts(now);

    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';

    // Convert to ISO 8601 (1=Mon, 7=Sun)
    const weekdayMap: Record<string, number> = {
      Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
    };

    return weekdayMap[weekdayStr] ?? 1;
  } catch {
    // Fallback: use UTC day
    const day = new Date().getUTCDay();
    return day === 0 ? 7 : day; // Convert 0=Sun to 7=Sun
  }
}

/**
 * Processes all active guilds and sends scheduled messages if applicable.
 *
 * @returns Promise resolving when all guilds are processed
 *
 * @remarks
 * Each guild is processed independently. Errors in one guild do not
 * block processing of others.
 *
 * @example
 * ```typescript
 * await processGuilds();
 * ```
 */
export async function processGuilds(): Promise<void> {
  const configs = guildConfigRepo.getAll();

  if (configs.length === 0) {
    return;
  }

  // Process all guilds concurrently
  const tasks = configs.map(async (config) => {
    try {
      const currentTime = getCurrentTimeInTimezone(config.timezone);
      const currentDay = getCurrentDayOfWeek(config.timezone);

      // Check if today is an active day
      if (!isDayActive(config, currentDay)) {
        return;
      }

      // Check each scheduled time slot
      for (const slot of config.scheduleTimes) {
        if (!isSlotScheduled(config, slot)) continue;

        if (currentTime === slot) {
          await sendScheduledMessage(config.guildId, slot);
        }
      }
    } catch (error) {
      console.error(
        `❌ [Scheduler] Error processing guild ${config.guildId}:`,
        error
      );
    }
  });

  await Promise.allSettled(tasks);
}

/**
 * Starts the cron scheduler.
 *
 * @remarks
 * The cron fires every minute: `* * * * *`
 * Only one scheduler instance runs at a time — calling start() when
 * already running has no effect.
 *
 * @example
 * ```typescript
 * startScheduler();
 * console.log('Scheduler started');
 * ```
 */
export function startScheduler(): void {
  if (schedulerTask) {
    console.log('⚠️ [Scheduler] Already running — ignoring duplicate start');
    return;
  }

  schedulerTask = cron.schedule('* * * * *', async () => {
    await processGuilds();
  }, {
    scheduled: true,
    timezone: 'UTC', // Cron runs in UTC; timezone conversion done per-guild
  });

  console.log('⏰ [Scheduler] Started — checking every minute');
}

/**
 * Stops the cron scheduler gracefully.
 *
 * @remarks
 * Safe to call even if scheduler is not running.
 *
 * @example
 * ```typescript
 * stopScheduler();
 * console.log('Scheduler stopped');
 * ```
 */
export function stopScheduler(): void {
  if (!schedulerTask) {
    return;
  }

  schedulerTask.stop();
  schedulerTask = null;
  console.log('⏹️ [Scheduler] Stopped');
}

/**
 * Returns whether the scheduler is currently running.
 *
 * @returns True if the scheduler is active
 *
 * @example
 * ```typescript
 * if (isSchedulerRunning()) {
 *   console.log('Scheduler is active');
 * }
 * ```
 */
export function isSchedulerRunning(): boolean {
  return schedulerTask !== null;
}
