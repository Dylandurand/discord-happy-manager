/**
 * Bot Module Exports
 *
 * Central export point for all bot-related functionality.
 *
 * @example
 * ```typescript
 * import { initializeClient, setupInteractionHandlers } from '@/bot';
 *
 * await initializeClient();
 * setupInteractionHandlers();
 * ```
 */

export { client, initializeClient, shutdownClient } from './client';
export { registerCommands, deleteCommands } from './registerCommands';
export { setupInteractionHandlers } from './interactionHandler';
