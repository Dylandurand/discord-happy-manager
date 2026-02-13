/**
 * Message Create Listener - Contextual Mode
 *
 * Listens for messages containing specific keywords and responds with
 * supportive messages when contextual mode is enabled.
 *
 * @remarks
 * - Only active when guild has contextualEnabled=true
 * - Strict 6-hour cooldown per guild
 * - Responses are neutral and actionable (no diagnosis)
 * - Keywords: stress, down, fatigué, procrastine, overwhelmed, anxious, tired
 *
 * @security
 * - Does not store message content
 * - Respects cooldowns strictly
 * - Requires MessageContent intent (granted only when feature enabled)
 *
 * @example
 * User: "Je suis tellement stressé aujourd'hui"
 * Bot: "Mini reset 🌿 — Respire profondément. Concentre-toi sur une tâche simple. Tu assures."
 */

import type { Message } from 'discord.js';
import { guildConfigRepo } from '@/db/guildConfigRepo';
import { cooldownRepo } from '@/db/cooldownRepo';
import { isInGrumpyChannel, handleGrumpyResult } from '@/listeners/onGrumpyResult';

/**
 * Keywords that trigger contextual responses.
 *
 * @remarks
 * - Case-insensitive matching
 * - Includes English and French keywords
 * - Focuses on stress, fatigue, and procrastination indicators
 */
const TRIGGER_KEYWORDS = [
  'stress',
  'stressed',
  'stressé',
  'stressée',
  'down',
  'fatigué',
  'fatiguée',
  'fatigue',
  'tired',
  'procrastine',
  'procrastinating',
  'overwhelmed',
  'débordé',
  'débordée',
  'anxious',
  'anxieux',
  'anxieuse',
  'épuisé',
  'épuisée',
  'exhausted',
  'burn out',
  'burnout',
  'découragé',
  'découragée',
];

/**
 * Contextual mode cooldown duration in hours.
 *
 * @remarks
 * Prevents spam - max 1 contextual response per 6 hours per guild.
 */
const CONTEXTUAL_COOLDOWN_HOURS = 6;

/**
 * Checks if a message contains trigger keywords.
 *
 * @param content - Message content to check
 * @returns True if message contains at least one trigger keyword
 *
 * @remarks
 * Case-insensitive whole-word matching to avoid false positives.
 *
 * @example
 * ```typescript
 * containsTriggerKeyword('Je suis trop stressé') // true
 * containsTriggerKeyword('Ceci est un test') // false
 * ```
 */
function containsTriggerKeyword(content: string): boolean {
  const lowerContent = content.toLowerCase();

  // Use word boundaries to match whole words only
  return TRIGGER_KEYWORDS.some((keyword) => {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    return regex.test(lowerContent);
  });
}

/**
 * Supportive contextual responses in French.
 *
 * @remarks
 * Responses follow the format: [Emoji] [Brief empathy] — [Micro-action]
 * Avoids diagnosis, medical advice, or promises.
 */
const CONTEXTUAL_RESPONSES = [
  "Mini reset 🌿 — Respire profondément. Étire-toi 30 secondes. Choisis une petite tâche.",
  "Pause moment 🌸 — Éloigne-toi 2 minutes. Regarde par la fenêtre. Reviens à l'essentiel.",
  "Micro pause 🍃 — Ferme les yeux. Compte jusqu'à 10 lentement. Rouvre-les et choisis ton prochain petit pas.",
  "Quick recharge ⚡ — Lève-toi, bouge un peu. Prends de l'eau. Commence par le plus facile.",
  "Rappel doux 💫 — Tu n'as pas à tout faire d'un coup. Quelle est la seule chose que tu peux faire maintenant ?",
  "Espace respiration 🌊 — Inspire 4 sec, retiens 4, expire 6. Répète 3 fois. Tu gères.",
  "Reset simple 🌻 — Note 3 trucs qui te tracassent. Choisis le plus petit pour commencer.",
  "Mini shift ☀️ — Change de position ou d'endroit. Nouvelle perspective. Tu assures.",
  "Petit break 🌙 — Pose ton regard ailleurs 30 secondes. Respire. Reprends par le plus simple.",
  "Recalibrage 🎯 — Qu'est-ce qui est urgent vs important ? Focus sur 1 truc. Le reste peut attendre.",
];

/**
 * Gets a random supportive response.
 *
 * @returns A neutral, actionable message in French
 */
function getRandomResponse(): string {
  const index = Math.floor(Math.random() * CONTEXTUAL_RESPONSES.length);
  return CONTEXTUAL_RESPONSES[index] ?? CONTEXTUAL_RESPONSES[0] ?? "Mini reset 🌿 — Prends une pause. Tu assures.";
}

/**
 * Handles incoming messages for contextual mode.
 *
 * @param message - Discord message event
 *
 * @remarks
 * Flow:
 * 1. Check if message is from a bot (ignore)
 * 2. Check if guild has contextual mode enabled
 * 3. Check for trigger keywords
 * 4. Check cooldown (6 hours)
 * 5. Send supportive response
 * 6. Set cooldown
 *
 * @throws Does not throw - errors are logged and silently handled
 *
 * @example
 * ```typescript
 * client.on(Events.MessageCreate, handleMessageCreate);
 * ```
 */
export async function handleMessageCreate(message: Message): Promise<void> {
  try {
    // ── Grumpy channel: process before the bot filter ──────────────────────
    // Grumpy is a bot — its messages must be handled here, before we discard
    // all bot messages below. Regular user messages in this channel are also
    // passed to handleGrumpyResult, which silently ignores non-decision text.
    if (isInGrumpyChannel(message)) {
      await handleGrumpyResult(message);
      return; // Don't apply contextual mode in the training channel
    }

    // Ignore bot messages (including our own)
    if (message.author.bot) {
      return;
    }

    // Ignore DMs
    if (!message.guildId) {
      return;
    }

    // Check if guild has contextual mode enabled
    const config = guildConfigRepo.get(message.guildId);
    if (!config || !config.contextualEnabled) {
      return;
    }

    // Check if message contains trigger keywords
    if (!containsTriggerKeyword(message.content)) {
      return;
    }

    // Check cooldown (6 hours per guild)
    const cooldownKey = `guild:${message.guildId}:contextual`;
    if (cooldownRepo.isOnCooldown(cooldownKey)) {
      // Silently ignore - cooldown active
      return;
    }

    // Get a random supportive response
    const response = getRandomResponse();

    // Send response in the same channel (check if channel supports sending messages)
    if ('send' in message.channel) {
      await message.channel.send(response);
      console.log(`🌿 Réponse contextuelle envoyée dans le serveur ${message.guildId} (canal ${message.channelId})`);
    } else {
      console.warn(`⚠️ Cannot send contextual response in channel ${message.channelId} (unsupported channel type)`);
      return;
    }

    // Set cooldown for 6 hours
    const cooldownUntil = new Date();
    cooldownUntil.setHours(cooldownUntil.getHours() + CONTEXTUAL_COOLDOWN_HOURS);
    cooldownRepo.set(cooldownKey, cooldownUntil);
  } catch (error) {
    // Log error but don't throw - contextual mode should fail silently
    console.error('❌ Erreur dans le gestionnaire de messages contextuels:', error);
  }
}
