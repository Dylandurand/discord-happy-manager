/**
 * Environment Configuration Loader
 *
 * Validates and loads environment variables with type safety.
 * Fails fast if required variables are missing.
 *
 * @remarks
 * Uses Zod for runtime validation and type inference.
 * All secrets (DISCORD_TOKEN, API_KEY) are never logged.
 *
 * @security
 * - Never log DISCORD_TOKEN or QUOTE_API_KEY
 * - Fail fast on missing required variables (prevents runtime errors)
 * - Validate format of critical values (e.g., paths)
 *
 * @example
 * ```typescript
 * import { env } from '@/config/env';
 *
 * console.log(env.DEFAULT_TIMEZONE); // "Europe/Paris"
 * // console.log(env.DISCORD_TOKEN); // ❌ NEVER log secrets
 * ```
 */

import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment variable schema with validation rules.
 *
 * @remarks
 * - DISCORD_TOKEN and DISCORD_CLIENT_ID are required
 * - SQLITE_PATH defaults to './data/happy.db'
 * - DEFAULT_TIMEZONE defaults to 'Europe/Paris'
 * - LOG_LEVEL defaults to 'info'
 */
const envSchema = z.object({
  // Discord Configuration (Required)
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),

  // Database Configuration
  SQLITE_PATH: z.string().default('./data/happy.db'),

  // Timezone Configuration
  DEFAULT_TIMEZONE: z.string().default('Europe/Paris'),

  // Quote API Configuration (Optional)
  QUOTE_API_URL: z.string().url().optional(),
  QUOTE_API_KEY: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/**
 * Validated environment configuration.
 *
 * @remarks
 * Inferred from Zod schema for type safety.
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Loads and validates environment variables.
 *
 * @returns Validated environment configuration
 *
 * @throws {z.ZodError} If validation fails (missing or invalid variables)
 *
 * @security
 * This function is called once at startup. If it throws, the application
 * should exit immediately (fail-fast pattern).
 *
 * @example
 * ```typescript
 * try {
 *   const config = loadEnv();
 *   console.log('Environment loaded successfully');
 * } catch (error) {
 *   console.error('Invalid environment:', error);
 *   process.exit(1);
 * }
 * ```
 */
export function loadEnv(): EnvConfig {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw error;
  }
}

/**
 * Global environment configuration instance.
 *
 * @remarks
 * Loaded once at module import. Use this instead of process.env directly.
 *
 * @security
 * - Never log env.DISCORD_TOKEN
 * - Never log env.QUOTE_API_KEY
 */
export const env = loadEnv();
