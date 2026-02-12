/**
 * Kudos Provider
 *
 * Parses and provides structured kudos templates from roadmap/kudos.md.
 * Each template contains variables: {membre}, {raison}, {impact}.
 *
 * @remarks
 * The kudos file contains 6 categories with multiple template variants.
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
  template: string;
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
   * @param filePath - Path to kudos.md (defaults to roadmap/kudos.md)
   *
   * @throws {KudosLoadError} If the file cannot be read or parsed
   */
  constructor(filePath?: string) {
    const resolvedPath = filePath ?? resolve(process.cwd(), 'roadmap', 'kudos.md');
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
    let message = template.template
      .replace(/{membre}/g, membre)
      .replace(/{raison}/g, raison)
      .replace(/{impact}/g, impact);

    // Add emoji prefix if not already in template
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
   * Loads and parses the kudos.md file.
   *
   * @param path - Absolute path to kudos.md
   *
   * @returns Map of category to templates
   *
   * @throws {KudosLoadError} If file cannot be read or parsed
   */
  private loadTemplates(path: string): Map<KudosCategory, KudosTemplate[]> {
    try {
      const content = readFileSync(path, 'utf-8');
      return this.parseKudosFile(content);
    } catch (error) {
      throw new KudosLoadError(
        `Failed to load kudos file at ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parses the kudos.md file content into structured templates.
   *
   * @param content - Raw file content
   *
   * @returns Map of category to templates
   */
  private parseKudosFile(content: string): Map<KudosCategory, KudosTemplate[]> {
    const result = new Map<KudosCategory, KudosTemplate[]>();
    const lines = content.split('\n');

    let currentCategory: KudosCategory | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Check for category header: ## Catégorie : {name}
      if (trimmed.startsWith('## Catégorie :')) {
        const categoryName = trimmed.replace('## Catégorie :', '').trim().toLowerCase();
        currentCategory = this.mapCategoryName(categoryName);

        if (currentCategory && !result.has(currentCategory)) {
          result.set(currentCategory, []);
        }
        continue;
      }

      // Parse template line (starts with emoji)
      if (currentCategory && this.startsWithEmoji(trimmed)) {
        const template = this.parseTemplateLine(trimmed);
        if (template) {
          result.get(currentCategory)?.push(template);
        }
      }
    }

    return result;
  }

  /**
   * Maps category display names to internal category keys.
   *
   * @param categoryName - Category name from file (lowercase)
   *
   * @returns Mapped category key or null
   */
  private mapCategoryName(categoryName: string): KudosCategory | null {
    const mapping: Record<string, KudosCategory> = {
      vente: 'vente',
      'discipline / focus': 'discipline',
      'entraide / contribution': 'entraide',
      leadership: 'leadership',
      'créativité / innovation': 'creativite',
      'persévérance / résilience': 'perseverance',
    };

    return mapping[categoryName] ?? null;
  }

  /**
   * Checks if a line starts with an emoji.
   *
   * @param line - Line to check
   *
   * @returns True if line starts with emoji
   */
  private startsWithEmoji(line: string): boolean {
    // Simple emoji detection: Unicode emoji range
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}]/u;
    return emojiRegex.test(line);
  }

  /**
   * Parses a single template line.
   *
   * @param line - Line starting with emoji
   *
   * @returns Parsed template or null
   *
   * @example
   * Input: "🎯 {membre} a renforcé son argumentaire sur {projet}."
   * Output: { emoji: "🎯", template: "{membre} a renforcé son argumentaire sur {projet}." }
   */
  private parseTemplateLine(line: string): KudosTemplate | null {
    // Extract emoji (first character)
    const emoji = line.charAt(0);

    // Extract template (rest of line, trimmed)
    const template = line.slice(1).trim();

    if (!template) return null;

    return { emoji, template };
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
