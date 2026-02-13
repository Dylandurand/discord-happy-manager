/**
 * Friday Victory Service
 *
 * Every Friday at a configured time, posts a motivational message in the
 * designated channel, mentioning all non-bot guild members and asking them
 * to share at least one win from their week.
 *
 * @remarks
 * - Config is loaded from data/friday-victories.json
 * - Day check: ISO day 5 (Friday) in the configured timezone
 * - Daily cooldown prevents duplicate posts within the same day
 * - Messages use {mentions} placeholder, replaced with @-mentions of all members
 * - Requires GuildMembers privileged intent (enabled in Discord Developer Portal)
 *
 * @example
 * Scheduler ticks at 15:00 Europe/Paris, Friday →
 * posts a random motivational message mentioning all non-bot members.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import type { TextChannel } from 'discord.js';
import { client } from '@/bot/client';
import { cooldownRepo } from '@/db';
import { getCurrentTimeInTimezone, getCurrentDayOfWeek } from '@/scheduler/scheduler';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FridayVictoryConfig {
  guildId: string;
  channelId: string;
  timezone: string;
  /** HH:MM at which the message fires (in the configured timezone) */
  checkTime: string;
  /** ISO day of week (1=Mon, 7=Sun; 5=Fri) */
  checkDay: number;
  /** Message templates — use {mentions} as placeholder for member @-mentions */
  messages: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Loads and parses friday-victories.json. Returns null on error.
 */
function loadConfig(): FridayVictoryConfig | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'friday-victories.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as FridayVictoryConfig;
  } catch (error) {
    console.error('❌ [FridayVictory] Impossible de charger data/friday-victories.json:', error);
    return null;
  }
}

/**
 * Returns today's date as "YYYY-MM-DD" in the given timezone.
 * Used as part of the daily cooldown key.
 */
function getTodayDateString(timezone: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year  = parts.find((p) => p.type === 'year')?.value  ?? '2000';
    const month = parts.find((p) => p.type === 'month')?.value ?? '01';
    const day   = parts.find((p) => p.type === 'day')?.value   ?? '01';

    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Builds the daily cooldown key for the friday victory message.
 */
function getCooldownKey(guildId: string, dateStr: string): string {
  return `friday-victory:${guildId}:${dateStr}`;
}

/**
 * Picks a random message template and replaces {mentions} with the given string.
 */
function pickMessage(messages: string[], mentions: string): string {
  const template =
    messages[Math.floor(Math.random() * messages.length)] ??
    messages[0] ??
    '🏆 {mentions} — Partagez vos victoires de la semaine ! 💪';

  return template.replace('{mentions}', mentions);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Checks if it's Friday at the configured time and posts a victory prompt.
 *
 * @remarks
 * Called every minute by the scheduler. The function is a no-op unless:
 * 1. The current day (in the configured timezone) matches checkDay (5 = Friday)
 * 2. The current time (in the configured timezone) matches checkTime
 * 3. The message hasn't been sent yet today (daily cooldown)
 *
 * @example
 * ```typescript
 * // In scheduler cron:
 * await processGuilds();
 * await checkBirthdays();
 * await checkFridayVictory();
 * ```
 */
export async function checkFridayVictory(): Promise<void> {
  const config = loadConfig();
  if (!config) return;

  // Only fire on the configured day of the week
  const currentDay = getCurrentDayOfWeek(config.timezone);
  if (currentDay !== config.checkDay) return;

  // Only fire at the configured time
  const currentTime = getCurrentTimeInTimezone(config.timezone);
  if (currentTime !== config.checkTime) return;

  // Daily cooldown — prevents double-send at the minute boundary
  const todayStr = getTodayDateString(config.timezone);
  const cooldownKey = getCooldownKey(config.guildId, todayStr);
  if (cooldownRepo.isOnCooldown(cooldownKey)) {
    console.log('⏭️ [FridayVictory] Message déjà envoyé ce vendredi');
    return;
  }

  // Resolve guild
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) {
    console.warn(`⚠️ [FridayVictory] Guild ${config.guildId} introuvable dans le cache`);
    return;
  }

  // Resolve channel
  const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    console.warn(`⚠️ [FridayVictory] Canal ${config.channelId} introuvable ou non textuel`);
    return;
  }

  // Fetch all guild members (requires GuildMembers privileged intent)
  try {
    await guild.members.fetch();
  } catch (error) {
    console.warn('⚠️ [FridayVictory] Impossible de récupérer les membres (intent GuildMembers activé ?):', error);
  }

  // Build mention string for all non-bot members
  const nonBotMembers = guild.members.cache.filter((m) => !m.user.bot);
  const mentions = nonBotMembers.map((m) => `<@${m.id}>`).join(' ');

  if (!mentions) {
    console.warn('⚠️ [FridayVictory] Aucun membre non-bot trouvé dans le cache');
    return;
  }

  // Post the message
  try {
    const message = pickMessage(config.messages, mentions);
    await channel.send(message);

    // Set 24h cooldown — prevents re-send if bot restarts during the day
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    cooldownRepo.set(cooldownKey, expiresAt);

    console.log(`🏆 [FridayVictory] Message de victoires envoyé dans #${channel.name} (${nonBotMembers.size} membres mentionnés)`);
  } catch (error) {
    console.error('❌ [FridayVictory] Erreur lors de l\'envoi du message:', error);
  }
}
