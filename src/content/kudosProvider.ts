/**
 * Kudos Provider
 *
 * Loads and provides structured kudos templates from data/kudos.json.
 * Each template contains variables: {membre}, {raison}, {impact}.
 *
 * @remarks
 * The kudos JSON file contains 6 categories with multiple template variants.
 * This provider selects a random template from the chosen category
 * and replaces variables with user-provided values.
 *
 * @example
 * ```typescript
 * const provider = getKudosProvider();
 * const kudos = provider.formatKudos('vente', '@Alice', 'a clarifié son positionnement', 'client convaincu');
 * await channel.send(kudos);
 * ```
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Kudos category types.
 */
export type KudosCategory =
  | 'vente'
  | 'discipline'
  | 'entraide'
  | 'leadership'
  | 'creativite'
  | 'perseverance';

/**
 * Valid kudos categories array for validation.
 */
export const VALID_KUDOS_CATEGORIES: KudosCategory[] = [
  'vente',
  'discipline',
  'entraide',
  'leadership',
  'creativite',
  'perseverance',
];

/**
 * Kudos category display names (for Discord choices).
 */
export const KUDOS_CATEGORY_LABELS: Record<KudosCategory, string> = {
  vente: 'Vente',
  discipline: 'Discipline / Focus',
  entraide: 'Entraide / Contribution',
  leadership: 'Leadership',
  creativite: 'Créativité / Innovation',
  perseverance: 'Persévérance / Résilience',
};

/**
 * A single kudos template with emoji and text pattern.
 */
interface KudosTemplate {
  /** Emoji prefix */
  emoji: string;

  /** Template string with {membre}, {raison}, {impact} variables */
  text: string;
}

/**
 * Category configuration from JSON.
 */
interface CategoryConfig {
  /** Display label */
  label: string;

  /** Array of templates */
  templates: KudosTemplate[];
}

/**
 * Structure of the kudos.json file.
 */
interface KudosJsonFile {
  version: string;
  description: string;
  variables: Record<string, string>;
  categories: Record<KudosCategory, CategoryConfig>;
}

/**
 * Thrown when the kudos file cannot be loaded or parsed.
 */
export class KudosLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KudosLoadError';
  }
}

/**
 * Provides structured kudos templates from kudos.md file.
 */
export class KudosProvider {
  /** In-memory cache of loaded templates by category */
  private readonly templates: Map<KudosCategory, KudosTemplate[]>;

  /**
   * Creates a KudosProvider instance and loads templates.
   *
   * @param filePath - Path to kudos.json (defaults to data/kudos.json)
   *
   * @throws {KudosLoadError} If the file cannot be read or parsed
   */
  constructor(filePath?: string) {
    const resolvedPath = filePath ?? resolve(process.cwd(), 'data', 'kudos.json');
    this.templates = this.loadTemplates(resolvedPath);
  }

  /**
   * Returns a formatted kudos message using a random template from the category.
   *
   * @param category - Kudos category
   * @param membre - Member mention or name
   * @param raison - Reason for kudos
   * @param impact - Impact observed
   *
   * @returns Formatted kudos message ready for Discord
   *
   * @throws {Error} If category has no templates
   *
   * @example
   * ```typescript
   * const message = provider.formatKudos(
   *   'vente',
   *   '@Alice',
   *   'a clarifié son positionnement',
   *   'client convaincu'
   * );
   * ```
   */
  formatKudos(
    category: KudosCategory,
    membre: string,
    raison: string,
    impact: string
  ): string {
    const categoryTemplates = this.templates.get(category);

    if (!categoryTemplates || categoryTemplates.length === 0) {
      throw new Error(`No templates found for category: ${category}`);
    }

    // Pick random template
    const template = this.pickRandom(categoryTemplates);

    // Replace variables
    let message = template.text
      .replace(/{membre}/g, membre)
      .replace(/{raison}/g, raison)
      .replace(/{impact}/g, impact);

    // Add emoji prefix if not already in message
    if (!message.startsWith(template.emoji)) {
      message = `${template.emoji} ${message}`;
    }

    return message;
  }

  /**
   * Gets all available categories.
   *
   * @returns Array of category keys
   */
  getCategories(): KudosCategory[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Gets the number of templates in a category.
   *
   * @param category - Kudos category
   *
   * @returns Template count
   */
  getTemplateCount(category: KudosCategory): number {
    return this.templates.get(category)?.length ?? 0;
  }

  /**
   * Loads and parses the kudos.json file.
   *
   * @param path - Absolute path to kudos.json
   *
   * @returns Map of category to templates
   *
   * @throws {KudosLoadError} If file cannot be read or parsed
   */
  private loadTemplates(path: string): Map<KudosCategory, KudosTemplate[]> {
    try {
      const content = readFileSync(path, 'utf-8');
      const data = JSON.parse(content) as KudosJsonFile;

      const result = new Map<KudosCategory, KudosTemplate[]>();

      // Load all categories from JSON
      for (const [category, config] of Object.entries(data.categories)) {
        result.set(category as KudosCategory, config.templates);
      }

      return result;
    } catch (error) {
      throw new KudosLoadError(
        `Failed to load kudos file at ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Picks a random element from an array.
   *
   * @param items - Array to pick from (must be non-empty)
   *
   * @returns Random element
   */
  private pickRandom<T>(items: T[]): T {
    const index = Math.floor(Math.random() * items.length);
    return items[index]!;
  }
}

/**
 * Singleton KudosProvider instance.
 *
 * @remarks
 * Lazy initialization — file is loaded on first use.
 */
let _kudosProvider: KudosProvider | null = null;

/**
 * Gets or creates the singleton KudosProvider instance.
 *
 * @returns Singleton KudosProvider
 */
export function getKudosProvider(): KudosProvider {
  if (!_kudosProvider) {
    _kudosProvider = new KudosProvider();
  }
  return _kudosProvider;
}
