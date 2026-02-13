/**
 * Grumpy Result Listener
 *
 * Monitors the sales-training channel for Grumpy bot decision messages,
 * extracts the conviction score, and lets Peppy (Happy Manager) react with
 * a contextual motivational message.
 *
 * @remarks
 * - Targets a single hardcoded channel: GRUMPY_CHANNEL_ID
 * - Parses "Score de conviction : XX/100" from Grumpy's decision embed/message
 * - Victory (≥ 75) → Peppy always reacts (rare, celebrate every time)
 * - Resilience (< 50) → Peppy reacts ~35% of the time (surprise effect)
 * - Perseverance (50–74) → Peppy reacts ~50% of the time
 *
 * @example
 * Grumpy posts: "DÉCISION : REFUS\nScore de conviction : 40/100\n..."
 * Peppy may post: "L'échec d'aujourd'hui est le carburant de demain. 💪 ..."
 */

import type { Message } from 'discord.js';
import { getGrumpyReaction, getScoreCategory } from '@/content/grumpyReactionProvider';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Discord channel ID of the Grumpy sales-training channel */
const GRUMPY_CHANNEL_ID = '1469266195118166086';

/** Regex to extract the conviction score from Grumpy's decision message */
const SCORE_REGEX = /Score de conviction\s*:\s*(\d+)\/100/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the message is posted in the Grumpy training channel.
 */
export function isInGrumpyChannel(message: Message): boolean {
  return message.channelId === GRUMPY_CHANNEL_ID;
}

/**
 * Attempts to extract the conviction score (0–100) from a message.
 *
 * @returns The score, or null if the message doesn't match the expected format
 */
function extractScore(content: string): number | null {
  const match = SCORE_REGEX.exec(content);
  if (!match || !match[1]) return null;

  const score = parseInt(match[1], 10);
  if (isNaN(score) || score < 0 || score > 100) return null;

  return score;
}

// ─── Main handler ────────────────────────────────────────────────────────────

/**
 * Handles a message from the Grumpy training channel.
 *
 * @param message - Discord message event (may be from a bot)
 *
 * @remarks
 * Call this BEFORE the bot-filter in onMessageCreate, because Grumpy is a bot
 * and its messages would otherwise be silently discarded.
 *
 * The function silently no-ops if:
 * - The message doesn't contain the score pattern (regular user messages)
 * - The random probability check decides Peppy should stay silent
 *
 * @example
 * ```typescript
 * if (isInGrumpyChannel(message)) {
 *   await handleGrumpyResult(message);
 *   return;
 * }
 * ```
 */
export async function handleGrumpyResult(message: Message): Promise<void> {
  try {
    const score = extractScore(message.content);
    if (score === null) {
      // Not a decision message (e.g. a user's practice message) — ignore
      return;
    }

    const category = getScoreCategory(score);
    const reaction = getGrumpyReaction(score);

    if (!reaction) {
      // Probability gate: Peppy stays silent this round
      console.log(
        `🤐 [Grumpy] score ${score}/100 (${category}) — Peppy reste silencieux cette fois`
      );
      return;
    }

    if (!('send' in message.channel)) {
      console.warn(`⚠️ [Grumpy] Canal ${message.channelId} ne supporte pas l'envoi de messages`);
      return;
    }

    await message.channel.send(reaction);
    console.log(
      `😊 [Grumpy] Peppy réagit — score ${score}/100 (${category}) dans le canal ${message.channelId}`
    );
  } catch (error) {
    // Fail silently — never crash the bot for a cosmetic feature
    console.error('❌ [Grumpy] Erreur lors de la réaction au résultat Grumpy:', error);
  }
}
