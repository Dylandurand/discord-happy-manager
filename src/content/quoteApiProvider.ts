/**
 * Quote API Content Provider
 *
 * Fetches motivational quotes from the Quotable.io API.
 * Falls back gracefully when the API is unreachable or returns invalid data.
 *
 * @remarks
 * API endpoint: GET https://api.quotable.io/random
 * Supports tag filtering for categorized content.
 * Timeout: API.TIMEOUT_MS (3 seconds)
 * Retries: API.MAX_RETRIES times with API.RETRY_DELAY_MS delay
 *
 * @see https://api.quotable.io
 *
 * @security
 * All API responses are validated before use.
 * Content passes through applyFilters() before being returned.
 *
 * @performance
 * Uses AbortController for request timeout enforcement.
 * Retries use exponential-ish delay to avoid hammering the API.
 *
 * @example
 * ```typescript
 * const provider = new QuoteApiProvider();
 * const item = await provider.getItem('motivation');
 * ```
 */

import type { ContentItem, ContentProvider } from '@/types';
import type { Category } from '@/config/constants';
import { API } from '@/config/constants';
import { applyFilters } from './filters';

/**
 * Raw response from Quotable.io API.
 */
interface QuotableResponse {
  _id: string;
  content: string;
  author: string;
  tags: string[];
  length: number;
}

/**
 * Category to Quotable tag mapping.
 *
 * @remarks
 * Quotable has specific tags. Map our categories to the closest ones.
 * If no matching tag, fetch without tag filter (general quotes).
 */
const CATEGORY_TO_QUOTABLE_TAGS: Partial<Record<Category, string[]>> = {
  motivation: ['motivational', 'success', 'inspirational'],
  wellbeing: ['happiness', 'life', 'wisdom'],
  focus: ['success', 'technology', 'business'],
  team: ['leadership', 'business', 'teamwork'],
};

/**
 * Thrown when the API request fails after all retries.
 */
export class ApiProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ApiProviderError';
  }
}

/**
 * Provides content by fetching quotes from Quotable.io.
 *
 * @implements {ContentProvider}
 */
export class QuoteApiProvider implements ContentProvider {
  private readonly baseUrl: string;

  /**
   * Creates a QuoteApiProvider instance.
   *
   * @param baseUrl - Base URL for the Quotable API (from env or default)
   */
  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? 'https://api.quotable.io';
  }

  /**
   * Fetches a quote from the API, optionally filtered by category.
   *
   * @param category - Optional category to map to API tags
   *
   * @returns Promise resolving to a ContentItem
   *
   * @throws {ApiProviderError} If all retries fail
   *
   * @example
   * ```typescript
   * const item = await provider.getItem('motivation');
   * console.log(`${item.text} — ${item.source}`);
   * ```
   */
  async getItem(category?: Category): Promise<ContentItem> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= API.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await this.delay(API.RETRY_DELAY_MS * attempt);
      }

      try {
        const item = await this.fetchQuote(category);
        return item;
      } catch (error) {
        lastError = error as Error;
      }
    }

    throw new ApiProviderError(
      `Quote API unavailable after ${API.MAX_RETRIES + 1} attempts`,
      undefined,
      lastError
    );
  }

  /**
   * Fetches a single quote from the API.
   *
   * @param category - Optional category for tag filtering
   *
   * @returns Promise resolving to a ContentItem
   *
   * @throws {ApiProviderError} If the request fails or response is invalid
   */
  private async fetchQuote(category?: Category): Promise<ContentItem> {
    const url = this.buildUrl(category);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'discord-happy-manager/1.0',
        },
      });

      if (!response.ok) {
        throw new ApiProviderError(
          `API returned HTTP ${response.status}`,
          response.status
        );
      }

      const data = (await response.json()) as QuotableResponse;
      return this.mapResponseToItem(data, category);
    } catch (error) {
      if (error instanceof ApiProviderError) throw error;

      const isAbort =
        error instanceof Error && error.name === 'AbortError';

      throw new ApiProviderError(
        isAbort ? `API request timed out after ${API.TIMEOUT_MS}ms` : 'API request failed',
        undefined,
        error as Error
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Builds the API URL with optional tag filter.
   *
   * @param category - Optional category for tag selection
   *
   * @returns Full API URL string
   *
   * @example
   * ```typescript
   * buildUrl('motivation');
   * // "https://api.quotable.io/random?tags=motivational|success|inspirational&maxLength=500"
   * ```
   */
  private buildUrl(category?: Category): string {
    const params = new URLSearchParams();
    params.set('maxLength', '500');

    if (category) {
      const tags = CATEGORY_TO_QUOTABLE_TAGS[category];
      if (tags && tags.length > 0) {
        params.set('tags', tags.join('|'));
      }
    }

    return `${this.baseUrl}/random?${params.toString()}`;
  }

  /**
   * Maps a Quotable API response to a ContentItem.
   *
   * @param data - Raw API response
   * @param category - Category to assign to the item
   *
   * @returns ContentItem
   *
   * @throws {ApiProviderError} If the response fails content filters
   */
  private mapResponseToItem(data: QuotableResponse, category?: Category): ContentItem {
    const resolvedCategory: Category = category ?? 'motivation';

    const item: ContentItem = {
      id: `api-${data._id}`,
      category: resolvedCategory,
      text: data.content,
      tags: data.tags,
      source: data.author,
      provider: 'api',
    };

    const filterResult = applyFilters(item);
    if (!filterResult.passed) {
      throw new ApiProviderError(
        `API content failed filter: ${filterResult.reason}`
      );
    }

    return item;
  }

  /**
   * Delays execution for a given number of milliseconds.
   *
   * @param ms - Milliseconds to wait
   *
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton QuoteApiProvider instance.
 *
 * @example
 * ```typescript
 * import { getQuoteApiProvider } from '@/content/quoteApiProvider';
 * const item = await getQuoteApiProvider().getItem('motivation');
 * ```
 */
let _quoteApiProvider: QuoteApiProvider | null = null;

/**
 * Gets or creates the singleton QuoteApiProvider instance.
 *
 * @returns Singleton QuoteApiProvider
 */
export function getQuoteApiProvider(): QuoteApiProvider {
  if (!_quoteApiProvider) {
    _quoteApiProvider = new QuoteApiProvider();
  }
  return _quoteApiProvider;
}
