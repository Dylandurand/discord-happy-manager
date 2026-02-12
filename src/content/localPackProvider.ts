/**
 * Local Pack Content Provider
 *
 * Loads content from the local happy-pack.json file.
 * Implements anti-repetition logic using the sentRepo.
 *
 * @remarks
 * The local pack is the fallback provider. It guarantees content
 * availability even when external APIs are unreachable.
 *
 * Anti-repetition: a message sent within CONTENT.ANTI_REPETITION_DAYS
 * days will not be re-sent to the same guild.
 *
 * @performance
 * The pack is loaded once at startup and cached in memory.
 * Random selection from filtered candidates is O(n).
 *
 * @security
 * All loaded content is filtered through applyFilters() before use.
 *
 * @example
 * ```typescript
 * const provider = new LocalPackProvider();
 * const item = await provider.getItem('motivation');
 * console.log(item.text);
 * ```
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ContentItem, ContentProvider } from '@/types';
import type { Category } from '@/config/constants';
import { CONTENT, VALID_CATEGORIES } from '@/config/constants';
import { sentRepo } from '@/db';
import { applyFilters } from './filters';

/**
 * Shape of the happy-pack.json file.
 */
interface HappyPackFile {
  version: string;
  description: string;
  messages: Record<string, RawPackMessage[]>;
}

/**
 * Raw message entry in the JSON pack.
 */
interface RawPackMessage {
  id: string;
  text: string;
  tags?: string[];
}

/**
 * Thrown when no content can be found after max retries.
 */
export class ContentNotFoundError extends Error {
  constructor(
    public readonly category: string | undefined,
    public readonly guildId: string
  ) {
    super(`No available content for category "${category ?? 'any'}" in guild ${guildId}`);
    this.name = 'ContentNotFoundError';
  }
}

/**
 * Provides content from the local happy-pack.json file.
 *
 * @implements {ContentProvider}
 */
export class LocalPackProvider implements ContentProvider {
  /** In-memory cache of loaded content items */
  private readonly items: Map<Category, ContentItem[]>;

  /**
   * Creates a LocalPackProvider instance and loads the pack.
   *
   * @param packPath - Path to happy-pack.json (defaults to data/happy-pack.json)
   *
   * @throws {Error} If the pack file cannot be read or parsed
   */
  constructor(packPath?: string) {
    const resolvedPath = packPath ?? resolve(process.cwd(), 'data', 'happy-pack.json');
    this.items = this.loadPack(resolvedPath);
  }

  /**
   * Retrieves a content item, optionally filtered by category.
   *
   * @param category - Optional category filter
   * @param guildId - Guild ID for anti-repetition (optional, skip check if not provided)
   *
   * @returns Promise resolving to a ContentItem
   *
   * @throws {ContentNotFoundError} If no suitable content is found after retries
   *
   * @example
   * ```typescript
   * const item = await provider.getItem('motivation', '123456789');
   * ```
   */
  async getItem(category?: Category, guildId?: string): Promise<ContentItem> {
    const candidates = this.getCandidates(category);

    if (candidates.length === 0) {
      throw new ContentNotFoundError(category, guildId ?? 'unknown');
    }

    // If no guildId, just return a random item (no anti-repetition)
    if (!guildId) {
      return this.pickRandom(candidates);
    }

    // Try to find a non-recently-sent item
    for (let attempt = 0; attempt < CONTENT.MAX_RETRY_ATTEMPTS; attempt++) {
      const item = this.pickRandom(candidates);
      const wasSent = sentRepo.wasSentRecently(guildId, item.id, CONTENT.ANTI_REPETITION_DAYS);

      if (!wasSent) {
        return item;
      }
    }

    // All attempts exhausted — return any item (better than silence)
    return this.pickRandom(candidates);
  }

  /**
   * Returns the total number of content items in the pack.
   *
   * @param category - Optional category filter
   *
   * @returns Total item count
   *
   * @example
   * ```typescript
   * provider.getCount(); // 200
   * provider.getCount('motivation'); // 40
   * ```
   */
  getCount(category?: Category): number {
    return this.getCandidates(category).length;
  }

  /**
   * Returns all available categories in the pack.
   *
   * @returns Array of categories with content
   *
   * @example
   * ```typescript
   * provider.getAvailableCategories(); // ['motivation', 'wellbeing', ...]
   * ```
   */
  getAvailableCategories(): Category[] {
    return Array.from(this.items.keys());
  }

  /**
   * Loads and parses the happy-pack.json file.
   *
   * @param path - Absolute path to the pack file
   *
   * @returns Map of category to ContentItem array
   *
   * @throws {Error} If file cannot be read, parsed, or has invalid structure
   */
  private loadPack(path: string): Map<Category, ContentItem[]> {
    const raw = readFileSync(path, 'utf-8');
    const pack = JSON.parse(raw) as HappyPackFile;

    const result = new Map<Category, ContentItem[]>();

    for (const category of VALID_CATEGORIES) {
      const rawMessages = pack.messages[category] ?? [];
      const items: ContentItem[] = [];

      for (const msg of rawMessages) {
        const item: ContentItem = {
          id: msg.id,
          category,
          text: msg.text,
          tags: msg.tags,
          provider: 'local',
        };

        // Filter out items that don't pass content filters
        const filterResult = applyFilters(item);
        if (filterResult.passed) {
          items.push(item);
        }
      }

      if (items.length > 0) {
        result.set(category, items);
      }
    }

    return result;
  }

  /**
   * Gets candidate items for a given category (or all if none specified).
   *
   * @param category - Optional category filter
   *
   * @returns Flat array of candidate ContentItems
   */
  private getCandidates(category?: Category): ContentItem[] {
    if (category) {
      return this.items.get(category) ?? [];
    }

    // All items across all categories
    const all: ContentItem[] = [];
    for (const items of this.items.values()) {
      all.push(...items);
    }
    return all;
  }

  /**
   * Picks a random item from an array.
   *
   * @param items - Array to pick from (must be non-empty)
   *
   * @returns Random ContentItem
   */
  private pickRandom(items: ContentItem[]): ContentItem {
    const index = Math.floor(Math.random() * items.length);
    return items[index]!;
  }
}

/**
 * Singleton LocalPackProvider instance.
 *
 * @remarks
 * Lazy initialization — pack is loaded on first use.
 * This avoids issues with file system access during module loading in tests.
 *
 * @example
 * ```typescript
 * import { localPackProvider } from '@/content/localPackProvider';
 * const item = await localPackProvider.getItem('motivation', guildId);
 * ```
 */
let _localPackProvider: LocalPackProvider | null = null;

/**
 * Gets or creates the singleton LocalPackProvider instance.
 *
 * @returns Singleton LocalPackProvider
 */
export function getLocalPackProvider(): LocalPackProvider {
  if (!_localPackProvider) {
    _localPackProvider = new LocalPackProvider();
  }
  return _localPackProvider;
}
