/**
 * Caffe Pause Service
 *
 * Once per week, at a randomly chosen weekday slot (Mon–Fri, 09:00–17:59),
 * posts a "benevolent urgency" message in the configured channel, mentioning
 * all non-bot members and asking them to join the "Pause Café / Thé" voice
 * channel to share a moment of gratitude, pride, or difficulty.
 *
 * @remarks
 * - Config loaded from data/caffe-pause.json
 * - Random slot (day + time) generated once per week and persisted in
 *   data/caffe-slot.json (runtime file, not committed to git)
 * - The slot is regenerated each Monday morning (week key roll-over)
 * - A weekly cooldown prevents double-posts if the bot restarts mid-minute
 * - Requires GuildMembers privileged intent for guild.members.fetch()
 *
 * @example
 * Week rolls → slot generated: Wednesday 11:34
 * Scheduler ticks at 11:34 Wed → posts message mentioning all members
 * → cooldown set for the week → no further posts until next Monday
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as path from 'path';
import type { TextChannel } from 'discord.js';
import { client } from '@/bot/client';
import { cooldownRepo } from '@/db';
import { getCurrentTimeInTimezone, getCurrentDayOfWeek } from '@/scheduler/scheduler';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaffePauseConfig {
  guildId: string;
  channelId: string;
  timezone: string;
  /** Message templates — use {mentions} as placeholder for @-mentions */
  messages: string[];
}

interface WeeklySlot {
  /** Epoch week number (reference: 2021-01-04 = week 0) — unique per 7-day period */
  weekKey: string;
  /** ISO weekday to post (1=Mon … 5=Fri) */
  day: number;
  /** HH:MM time to post */
  time: string;
}

// ─── File paths ───────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(process.cwd(), 'data', 'caffe-pause.json');
const SLOT_PATH   = path.join(process.cwd(), 'data', 'caffe-slot.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Loads and parses caffe-pause.json. Returns null on error.
 */
function loadConfig(): CaffePauseConfig | null {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as CaffePauseConfig;
  } catch (error) {
    console.error('❌ [CaffePause] Impossible de charger data/caffe-pause.json:', error);
    return null;
  }
}

/**
 * Returns a stable weekly key based on the number of full weeks elapsed since
 * 2021-01-04 (a Monday). Rolls over every 7 days at UTC midnight Monday,
 * which corresponds to 01:00–02:00 Paris time — well before the 09:00 post window.
 */
function getCurrentWeekKey(): string {
  const REF_MONDAY_MS = new Date('2021-01-04T00:00:00Z').getTime();
  const MS_PER_WEEK   = 7 * 24 * 60 * 60 * 1000;
  const weekNum = Math.floor((Date.now() - REF_MONDAY_MS) / MS_PER_WEEK);
  return `week-${weekNum}`;
}

/**
 * Generates a random weekday slot within 09:00–17:59.
 */
function generateRandomSlot(): { day: number; time: string } {
  const day    = Math.floor(Math.random() * 5) + 1;            // 1–5 (Mon–Fri)
  const hour   = Math.floor(Math.random() * 9) + 9;            // 9–17
  const minute = Math.floor(Math.random() * 60);               // 0–59

  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { day, time };
}

/**
 * Loads the stored weekly slot, or generates a new one if the week has changed.
 *
 * @remarks
 * The slot is persisted in data/caffe-slot.json so that a bot restart mid-week
 * keeps the same randomly chosen day/time.
 */
function loadOrGenerateSlot(): WeeklySlot {
  const weekKey = getCurrentWeekKey();

  // Try to reuse the stored slot if it belongs to the current week
  if (existsSync(SLOT_PATH)) {
    try {
      const stored = JSON.parse(readFileSync(SLOT_PATH, 'utf-8')) as WeeklySlot;
      if (stored.weekKey === weekKey) {
        return stored;
      }
    } catch {
      // Corrupted file — fall through to regenerate
    }
  }

  // Generate a new slot for this week
  const { day, time } = generateRandomSlot();
  const slot: WeeklySlot = { weekKey, day, time };

  const dayNames: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven' };

  try {
    writeFileSync(SLOT_PATH, JSON.stringify(slot, null, 2));
    console.log(`📅 [CaffePause] Nouveau slot généré : ${dayNames[day] ?? '?'} à ${time}`);
  } catch (error) {
    console.error('❌ [CaffePause] Impossible de sauvegarder le slot:', error);
  }

  return slot;
}

/**
 * Picks a random message template and substitutes {mentions}.
 */
function pickMessage(messages: string[], mentions: string): string {
  const template =
    messages[Math.floor(Math.random() * messages.length)] ??
    messages[0] ??
    '☕ {mentions} — Direction **Pause Café / Thé** immédiatement ! 💛';

  return template.replace('{mentions}', mentions);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Checks if the current minute matches this week's random slot and,
 * if so, posts the benevolent urgency message.
 *
 * @remarks
 * Called every minute by the scheduler. The function is a no-op unless:
 * 1. The current ISO weekday matches the slot's day
 * 2. The current HH:MM (in config timezone) matches the slot's time
 * 3. The weekly cooldown has not been consumed yet
 *
 * @example
 * ```typescript
 * // In scheduler cron:
 * await checkCaffePause();
 * ```
 */
export async function checkCaffePause(): Promise<void> {
  const config = loadConfig();
  if (!config) return;

  const slot = loadOrGenerateSlot();

  // Day + time gate
  const currentDay  = getCurrentDayOfWeek(config.timezone);
  const currentTime = getCurrentTimeInTimezone(config.timezone);

  if (currentDay !== slot.day || currentTime !== slot.time) return;

  // Weekly cooldown — prevents double-post on restarts at the exact minute
  const cooldownKey = `caffe-pause:${config.guildId}:${slot.weekKey}`;
  if (cooldownRepo.isOnCooldown(cooldownKey)) {
    console.log('⏭️ [CaffePause] Message déjà envoyé cette semaine');
    return;
  }

  // Resolve guild
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) {
    console.warn(`⚠️ [CaffePause] Guild ${config.guildId} introuvable dans le cache`);
    return;
  }

  // Resolve channel
  const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    console.warn(`⚠️ [CaffePause] Canal ${config.channelId} introuvable ou non textuel`);
    return;
  }

  // Fetch all guild members (requires GuildMembers privileged intent)
  try {
    await guild.members.fetch();
  } catch (error) {
    console.warn('⚠️ [CaffePause] Impossible de récupérer les membres (intent GuildMembers activé ?):', error);
  }

  // Build @-mention string for all non-bot members
  const nonBotMembers = guild.members.cache.filter((m) => !m.user.bot);
  const mentions = nonBotMembers.map((m) => `<@${m.id}>`).join(' ');

  if (!mentions) {
    console.warn('⚠️ [CaffePause] Aucun membre non-bot trouvé dans le cache');
    return;
  }

  // Post the message
  try {
    const message = pickMessage(config.messages, mentions);
    await channel.send(message);

    // Weekly cooldown (168 h) — belt-and-suspenders alongside the slot mechanism
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 168);
    cooldownRepo.set(cooldownKey, expiresAt);

    console.log(
      `☕ [CaffePause] Message envoyé dans #${channel.name} (${nonBotMembers.size} membres mentionnés)`
    );
  } catch (error) {
    console.error('❌ [CaffePause] Erreur lors de l\'envoi du message:', error);
  }
}
