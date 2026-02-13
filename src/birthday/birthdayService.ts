/**
 * Birthday Service
 *
 * Checks every morning at a configured time whether it is a server member's
 * birthday and posts a warm, festive message in the designated channel.
 *
 * @remarks
 * - Config is loaded from data/birthdays.json
 * - Daily cooldown (per person per date) prevents duplicate posts
 * - Messages are randomly picked from a pool of 10 templates
 * - Called by the scheduler cron every minute; no-ops until checkTime matches
 *
 * @example
 * Scheduler ticks at 09:00 Europe/Paris → finds Dylan's birthday today →
 * posts a festive message in the configured channel.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import type { TextChannel } from 'discord.js';
import { client } from '@/bot/client';
import { cooldownRepo } from '@/db';
import { getCurrentTimeInTimezone } from '@/scheduler/scheduler';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BirthdayMember {
  /** Discord username (for display / logging) */
  discordName: string;
  /** Friendly name or alias used in the birthday message */
  displayName: string;
  /** Birth month (1–12) */
  month: number;
  /** Birth day (1–31) */
  day: number;
}

interface BirthdayConfig {
  guildId: string;
  channelId: string;
  timezone: string;
  /** HH:MM at which the birthday check fires (in the configured timezone) */
  checkTime: string;
  members: BirthdayMember[];
}

// ─── Message pool ─────────────────────────────────────────────────────────────

/**
 * Birthday message templates. Use {name} as the placeholder for the display name.
 */
const BIRTHDAY_MESSAGES: string[] = [
  "🎂 Joyeux anniversaire **{name}** ! 🥳 Toute l'équipe est là pour célébrer avec toi. Profite bien de ta journée, tu le mérites amplement !",
  "🎉 HAPPY BIRTHDAY **{name}** ! 🎊 C'est officiellement le jour le plus cool de l'année... le tien ! On t'aime fort, profite à fond !",
  "🕯️ C'est l'anniversaire de **{name}** aujourd'hui ! 🎂 Que cette journée soit remplie de joie, de rires et de bonnes surprises. Joyeux anni ! 🥂",
  "🎈 Ding ding ding ! Aujourd'hui, c'est le grand jour de **{name}** ! 🎁 On espère que tu as prévu quelque chose d'exceptionnel. Joyeux anniversaire ! 🥳",
  "🚀 Houston, on a un anniversaire ! 🎂 **{name}**, souffle les bougies et fais un vœu ! Toute l'équipe te souhaite une journée mémorable ! ✨",
  "🌟 Une seule personne mérite tous les spotlights aujourd'hui : **{name}** ! Joyeux anniversaire ! 🎉 Que cette nouvelle année t'apporte tout ce que tu désires !",
  "🎊 C'est parti pour les festivités ! **{name}**, c'est ton jour J ! 🥳 On espère que le gâteau sera à la hauteur de tes ambitions... (au moins très bon 😄) Joyeux anni !",
  "🎁 Petite attention du bot : aujourd'hui, **{name}** a officiellement le droit de ne rien faire de raisonnable. 🎂 JOYEUX ANNIVERSAIRE ! Profite à fond ! 🥂",
  "🥳 Alerte anniversaire ! 🚨 **{name}** célèbre son jour aujourd'hui ! L'équipe entière te souhaite une journée fabuleuse. Tu mérites tous les confettis du monde ! 🎊",
  "🎂 **{name}** ! C'est le moment de souffler les bougies et de faire un vœu ! 💫 De toute l'équipe, on te souhaite une journée exceptionnelle. Joyeux anniversaire, et que cette nouvelle année soit pleine de succès ! 🌟",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Loads and parses birthdays.json. Returns null on error.
 */
function loadConfig(): BirthdayConfig | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'birthdays.json');
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as BirthdayConfig;
  } catch (error) {
    console.error('❌ [Birthday] Impossible de charger data/birthdays.json:', error);
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
 * Returns the current month and day in the given timezone.
 */
function getTodayMonthDay(timezone: string): { month: number; day: number } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);

    const month = parseInt(parts.find((p) => p.type === 'month')?.value ?? '1', 10);
    const day   = parseInt(parts.find((p) => p.type === 'day')?.value   ?? '1', 10);

    return { month, day };
  } catch {
    const now = new Date();
    return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  }
}

/**
 * Filters members whose birthday matches today's date.
 */
function getTodayBirthdays(
  members: BirthdayMember[],
  timezone: string
): BirthdayMember[] {
  const { month, day } = getTodayMonthDay(timezone);
  return members.filter((m) => m.month === month && m.day === day);
}

/**
 * Builds a daily cooldown key unique to a member and date.
 * Prevents double-posting if the cron fires more than once at checkTime.
 */
function getCooldownKey(guildId: string, discordName: string, dateStr: string): string {
  return `birthday:${guildId}:${discordName}:${dateStr}`;
}

/**
 * Picks a random birthday message for the given display name.
 */
function pickMessage(displayName: string): string {
  const template = BIRTHDAY_MESSAGES[Math.floor(Math.random() * BIRTHDAY_MESSAGES.length)]
    ?? BIRTHDAY_MESSAGES[0]
    ?? "🎂 Joyeux anniversaire **{name}** ! 🥳";

  return template.replace('{name}', displayName);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Checks if it's time to post birthday wishes and does so if applicable.
 *
 * @remarks
 * Called every minute by the scheduler. The function is a no-op unless:
 * 1. The current time (in the configured timezone) matches `checkTime`
 * 2. At least one member has a birthday today
 * 3. That member's birthday message hasn't been sent yet today (cooldown check)
 *
 * @example
 * ```typescript
 * // In scheduler cron:
 * await processGuilds();
 * await checkBirthdays();
 * ```
 */
export async function checkBirthdays(): Promise<void> {
  const config = loadConfig();
  if (!config) return;

  // Only fire at the configured check time
  const currentTime = getCurrentTimeInTimezone(config.timezone);
  if (currentTime !== config.checkTime) return;

  const todayStr = getTodayDateString(config.timezone);
  const todayMembers = getTodayBirthdays(config.members, config.timezone);

  if (todayMembers.length === 0) return;

  // Resolve the target channel once
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) {
    console.warn(`⚠️ [Birthday] Guild ${config.guildId} introuvable dans le cache`);
    return;
  }

  const channel = guild.channels.cache.get(config.channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    console.warn(`⚠️ [Birthday] Canal ${config.channelId} introuvable ou non textuel`);
    return;
  }

  for (const member of todayMembers) {
    const cooldownKey = getCooldownKey(config.guildId, member.discordName, todayStr);

    // Skip if already posted today
    if (cooldownRepo.isOnCooldown(cooldownKey)) {
      console.log(`⏭️ [Birthday] ${member.displayName} — déjà souhaité aujourd'hui`);
      continue;
    }

    try {
      const message = pickMessage(member.displayName);
      await channel.send(message);

      // Set cooldown for 24 h — prevents duplicate if bot restarts during the day
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      cooldownRepo.set(cooldownKey, expiresAt);

      console.log(`🎂 [Birthday] Anniversaire souhaité à ${member.displayName} dans #${channel.name}`);
    } catch (error) {
      console.error(`❌ [Birthday] Erreur pour ${member.displayName}:`, error);
    }
  }
}
