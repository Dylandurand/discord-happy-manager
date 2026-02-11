/**
 * Application Constants
 *
 * Global constants used throughout the application.
 * Centralized configuration for magic numbers and strings.
 *
 * @remarks
 * Prefer constants over magic numbers/strings for maintainability.
 * Group related constants by domain (content, scheduler, discord, etc.).
 */

/**
 * Content categories for messages.
 */
export const CATEGORIES = {
  MOTIVATION: 'motivation',
  WELLBEING: 'wellbeing',
  FOCUS: 'focus',
  TEAM: 'team',
  FUN: 'fun',
} as const;

/**
 * Content category type (union of all categories).
 */
export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

/**
 * Valid categories array for validation.
 */
export const VALID_CATEGORIES: Category[] = Object.values(CATEGORIES);

/**
 * Content filtering and validation constants.
 */
export const CONTENT = {
  /** Maximum message length (hard cap) */
  MAX_LENGTH: 600,

  /** Ideal message length for readability */
  IDEAL_LENGTH: 350,

  /** Maximum number of emojis allowed per message */
  MAX_EMOJIS: 2,

  /** Anti-repetition window in days */
  ANTI_REPETITION_DAYS: 30,

  /** Maximum retry attempts to find non-repeated content */
  MAX_RETRY_ATTEMPTS: 10,
} as const;

/**
 * Scheduler configuration constants.
 */
export const SCHEDULER = {
  /** Default cadence (messages per day) */
  DEFAULT_CADENCE: 2,

  /** Maximum cadence (messages per day) */
  MAX_CADENCE: 3,

  /** Default schedule times for 2 messages/day */
  DEFAULT_TIMES_2: ['09:15', '16:30'],

  /** Default schedule times for 3 messages/day */
  DEFAULT_TIMES_3: ['09:15', '12:45', '16:30'],

  /** Default active days (Monday to Friday = 1-5) */
  DEFAULT_ACTIVE_DAYS: [1, 2, 3, 4, 5],

  /** Default timezone */
  DEFAULT_TIMEZONE: 'Europe/Paris',
} as const;

/**
 * Cooldown durations (in seconds).
 */
export const COOLDOWNS = {
  /** Cooldown for /happy now command (seconds) */
  NOW_COMMAND: 60,

  /** Cooldown for /happy kudos per user (seconds) */
  KUDOS_COMMAND: 300, // 5 minutes

  /** Cooldown for contextual responses per guild (seconds) */
  CONTEXTUAL_RESPONSE: 21600, // 6 hours
} as const;

/**
 * Discord-specific constants.
 */
export const DISCORD = {
  /** Maximum embed description length */
  MAX_EMBED_LENGTH: 4096,

  /** Maximum embed field value length */
  MAX_FIELD_LENGTH: 1024,

  /** Maximum number of embeds per message */
  MAX_EMBEDS: 10,

  /** Color for success embeds (green) */
  COLOR_SUCCESS: 0x57f287,

  /** Color for error embeds (red) */
  COLOR_ERROR: 0xed4245,

  /** Color for info embeds (blue) */
  COLOR_INFO: 0x5865f2,

  /** Color for warning embeds (yellow) */
  COLOR_WARNING: 0xfee75c,
} as const;

/**
 * Database constants.
 */
export const DATABASE = {
  /** SQLite WAL mode for better concurrency */
  WAL_MODE: true,

  /** Cache TTL for guild configs (milliseconds) */
  GUILD_CONFIG_CACHE_TTL: 300000, // 5 minutes

  /** Maximum number of rows to return in queries (safety limit) */
  MAX_QUERY_LIMIT: 1000,
} as const;

/**
 * Content provider priorities (lower = higher priority).
 */
export const PROVIDER_PRIORITY = {
  API: 1,
  LOCAL: 2,
  RSS: 3,
} as const;

/**
 * API configuration.
 */
export const API = {
  /** API request timeout (milliseconds) */
  TIMEOUT_MS: 3000,

  /** Maximum retries for failed API requests */
  MAX_RETRIES: 2,

  /** Retry delay (milliseconds) */
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Banned words for content filtering (security).
 *
 * @security
 * Prevents medical, psychological, political, or adult content.
 *
 * @remarks
 * Keep this list updated based on observed issues.
 * Add words in lowercase (filter does case-insensitive comparison).
 */
export const BANNED_WORDS = [
  // Medical/Psychological (avoid giving medical advice)
  'suicide',
  'depression',
  'anxiety',
  'therapy',
  'therapist',
  'medication',
  'pills',
  'antidepressant',
  'psychiatrist',
  'diagnosis',
  'disorder',

  // Inappropriate content
  'fuck',
  'shit',
  'damn',
  'hell',
  'ass',
  'bitch',

  // Prosélytisme
  'god',
  'jesus',
  'allah',
  'religion',
  'pray',
  'prayer',

  // Political
  'politics',
  'election',
  'government',
  'president',

  // Culpabilisant
  'must',
  'should',
  'have to',
  'need to',
  'failure',
  'lazy',
] as const;

/**
 * Contextual mode keywords (trigger words).
 *
 * @remarks
 * Only used when contextual mode is enabled.
 * Case-insensitive matching.
 */
export const CONTEXTUAL_KEYWORDS = [
  'stress',
  'stressed',
  'down',
  'tired',
  'fatigué',
  'fatigue',
  'procrastine',
  'procrastinate',
  'overwhelmed',
  'débordé',
] as const;

/**
 * Slot-to-category mapping for scheduled messages.
 *
 * @remarks
 * Maps time slots to preferred content categories.
 */
export const SLOT_CATEGORY_MAP: Record<string, Category> = {
  '09:15': CATEGORIES.MOTIVATION, // Morning kick-off
  '12:45': CATEGORIES.WELLBEING, // Mid-day break
  '16:30': CATEGORIES.TEAM, // Afternoon reset
} as const;

/**
 * Application metadata.
 */
export const APP = {
  NAME: 'Happy Manager Bot',
  VERSION: '0.1.0',
  DESCRIPTION: 'Discord bot for motivational messages and team well-being',
} as const;
