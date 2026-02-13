/**
 * Grumpy Reaction Provider
 *
 * Selects motivational messages for Peppy (Happy Manager) to post in response
 * to Grumpy bot's sales training results.
 *
 * @remarks
 * Three score bands, each with 25 unique messages:
 * - score < 50  → "resilience"   — posted 35% of the time (surprise effect)
 * - 50–74       → "perseverance" — posted 50% of the time
 * - ≥ 75        → "victory"      — posted 100% of the time (rare event, always celebrated)
 *
 * Messages are loaded from data/grumpy-reactions.json at first call and cached.
 */

import { readFileSync } from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GrumpyScoreCategory = 'resilience' | 'perseverance' | 'victory';

interface GrumpyReactions {
  resilience: string[];
  perseverance: string[];
  victory: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Probability that Peppy reacts when score < 50 (resilience) */
const RESILIENCE_PROBABILITY = 0.35;

/** Probability that Peppy reacts when 50 ≤ score < 75 (perseverance) */
const PERSEVERANCE_PROBABILITY = 0.50;

// ─── Internal state ──────────────────────────────────────────────────────────

let reactionsCache: GrumpyReactions | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Loads and caches the reactions JSON file.
 *
 * @throws {Error} If the file is missing or malformed
 */
function loadReactions(): GrumpyReactions {
  if (reactionsCache) return reactionsCache;

  const filePath = path.join(process.cwd(), 'data', 'grumpy-reactions.json');
  const raw = readFileSync(filePath, 'utf-8');
  reactionsCache = JSON.parse(raw) as GrumpyReactions;
  return reactionsCache;
}

/**
 * Returns a random element from an array.
 */
function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Determines the score category from a raw conviction score.
 *
 * @param score - Conviction score (0–100)
 * @returns The matching category
 *
 * @example
 * getScoreCategory(40)  // 'resilience'
 * getScoreCategory(60)  // 'perseverance'
 * getScoreCategory(80)  // 'victory'
 */
export function getScoreCategory(score: number): GrumpyScoreCategory {
  if (score < 50) return 'resilience';
  if (score < 75) return 'perseverance';
  return 'victory';
}

/**
 * Returns a reaction message for the given conviction score, or null if the
 * random probability check decides Peppy should stay silent this time.
 *
 * @param score - Conviction score extracted from Grumpy's decision (0–100)
 * @returns A message string, or null (Peppy stays quiet)
 *
 * @remarks
 * - Victory (≥ 75) is always returned — it's a rare achievement worth celebrating.
 * - Resilience and perseverance are gated by probability for the surprise effect.
 *
 * @example
 * const reaction = getGrumpyReaction(42);
 * if (reaction) await channel.send(reaction);
 */
export function getGrumpyReaction(score: number): string | null {
  const category = getScoreCategory(score);

  // Probability gate (not applied for victory — always react)
  if (category === 'resilience' && Math.random() > RESILIENCE_PROBABILITY) {
    return null;
  }
  if (category === 'perseverance' && Math.random() > PERSEVERANCE_PROBABILITY) {
    return null;
  }

  const reactions = loadReactions();
  return pickRandom(reactions[category]);
}
