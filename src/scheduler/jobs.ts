/**
 * Scheduler Jobs
 *
 * Core scheduling logic: slot-to-category mapping and message delivery.
 *
 * @remarks
 * This module is responsible for:
 * - Mapping time slots to content categories
 * - Determining if a scheduled message should fire for a guild
 * - Delivering scheduled messages to the correct Discord channel
 *
 * Called by the cron scheduler every minute.
 *
 * @example
 * ```typescript
 * await sendScheduledMessage('123456789', '09:15');
 * ```
 */

import type { TextChannel } from 'discord.js';
import type { GuildConfig } from '@/types';
import type { Category } from '@/config/constants';
import { SLOT_CATEGORY_MAP } from '@/config/constants';
import { guildConfigRepo, cooldownRepo } from '@/db';
import { client } from '@/bot/client';
import { getFormattedContent, recordSentContent } from '@/content';

/**
 * Duration in seconds to lock a slot after delivery (prevents double-send).
 *
 * @remarks
 * Set to 90s (> 1 cron minute) to avoid duplicate sends when cron fires
 * at minute boundaries (e.g., 09:15:00 and 09:15:59).
 */
const SLOT_LOCK_SECONDS = 90;

/**
 * Gets the cooldown key for a guild's scheduled slot.
 *
 * @param guildId - Discord guild ID
 * @param slot - Time slot in HH:MM format
 *
 * @returns Cooldown key string
 *
 * @example
 * ```typescript
 * getSlotCooldownKey('123456789', '09:15');
 * // "scheduled:123456789:09:15"
 * ```
 */
export function getSlotCooldownKey(guildId: string, slot: string): string {
  return `scheduled:${guildId}:${slot}`;
}

/**
 * Maps a time slot to a content category.
 *
 * @param slot - Time slot in HH:MM format
 * @param cadence - Number of messages per day (2 or 3)
 *
 * @returns Content category for the slot
 *
 * @remarks
 * Uses SLOT_CATEGORY_MAP from constants as primary lookup.
 * Falls back to 'motivation' if slot is not found in map.
 *
 * @example
 * ```typescript
 * getSlotCategory('09:15', 2); // 'motivation'
 * getSlotCategory('12:45', 3); // 'wellbeing'
 * getSlotCategory('16:30', 2); // 'team'
 * ```
 */
export function getSlotCategory(slot: string, cadence: 2 | 3): Category {
  const mapped = SLOT_CATEGORY_MAP[slot];
  if (mapped) return mapped;

  // For cadence=3, 12:45 may use a different category
  if (cadence === 3 && slot === '12:45') {
    return 'wellbeing';
  }

  return 'motivation';
}

/**
 * Sends a scheduled message for a guild and time slot.
 *
 * @param guildId - Discord guild ID
 * @param slot - Time slot in HH:MM format
 *
 * @returns Promise resolving when message is sent (or skipped if conditions not met)
 *
 * @remarks
 * The function checks:
 * 1. Guild config exists and channel is configured
 * 2. Slot not already sent (cooldown lock)
 * 3. Discord channel accessible
 *
 * Errors are logged but do not throw (scheduler must continue for other guilds).
 *
 * @example
 * ```typescript
 * await sendScheduledMessage('123456789', '09:15');
 * ```
 */
export async function sendScheduledMessage(guildId: string, slot: string): Promise<void> {
  const config = guildConfigRepo.get(guildId);
  if (!config || !config.channelId) {
    return;
  }

  // Check slot cooldown (prevent double-send within same minute)
  const cooldownKey = getSlotCooldownKey(guildId, slot);
  if (cooldownRepo.isOnCooldown(cooldownKey)) {
    return;
  }

  // Get Discord channel
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.warn(`[Scheduler] Guild ${guildId} not in cache — skipping slot ${slot}`);
    return;
  }

  const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    console.warn(
      `[Scheduler] Channel ${config.channelId} not found or not text-based in guild ${guildId}`
    );
    return;
  }

  // Determine category for this slot
  const category = getSlotCategory(slot, config.cadence);

  try {
    // Fetch formatted content (API → local fallback)
    const result = await getFormattedContent({
      guildId,
      category,
      timeSlot: slot,
      localOnly: false,
    });

    // Send to channel
    await (channel as TextChannel).send(result.message);

    // Record delivery in DB (overwrite the placeholder channelId from getFormattedContent)
    recordSentContent(guildId, config.channelId, result.item);

    // Lock slot for 90s to prevent duplicate
    cooldownRepo.setWithDuration(cooldownKey, SLOT_LOCK_SECONDS);

    console.log(
      `📅 [Scheduler] Sent "${category}" to #${channel.name} in "${guild.name}" [slot ${slot}] ` +
        `[${result.item.provider}:${result.item.id}]`
    );
  } catch (error) {
    console.error(
      `❌ [Scheduler] Failed to send scheduled message for guild ${guildId} slot ${slot}:`,
      error
    );
  }
}

/**
 * Checks if a given day of week is active for a guild config.
 *
 * @param config - Guild configuration
 * @param dayOfWeek - Day of week (1=Monday, 7=Sunday, ISO 8601)
 *
 * @returns True if the day is in the active days list
 *
 * @example
 * ```typescript
 * isDayActive(config, 1); // true (Monday is active by default)
 * isDayActive(config, 6); // false (Saturday not active by default)
 * ```
 */
export function isDayActive(config: GuildConfig, dayOfWeek: number): boolean {
  return config.activeDays.includes(dayOfWeek);
}

/**
 * Checks if a given slot is scheduled for a guild config.
 *
 * @param config - Guild configuration
 * @param slot - Time slot in HH:MM format
 *
 * @returns True if the slot is in the guild's scheduled times
 *
 * @example
 * ```typescript
 * isSlotScheduled(config, '09:15'); // true (default)
 * isSlotScheduled(config, '12:45'); // depends on cadence
 * ```
 */
export function isSlotScheduled(config: GuildConfig, slot: string): boolean {
  return config.scheduleTimes.includes(slot);
}
