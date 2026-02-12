/**
 * Global test setup file.
 *
 * Sets environment variables required by the application
 * before any test modules are imported.
 */

import { vi } from 'vitest';

// Set required env vars before any module loads
process.env['DISCORD_TOKEN'] = 'test_token_placeholder';
process.env['DISCORD_CLIENT_ID'] = '123456789012345678';
process.env['SQLITE_PATH'] = ':memory:';
process.env['DEFAULT_TIMEZONE'] = 'Europe/Paris';
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'error';

// Mock discord.js to avoid real network connections
vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>();
  return {
    ...actual,
    Client: vi.fn().mockImplementation(() => ({
      guilds: { cache: new Map() },
      user: null,
      login: vi.fn().mockResolvedValue('mock-token'),
      destroy: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
    })),
  };
});

// Mock node-cron to avoid real scheduling in tests
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue({
      stop: vi.fn(),
    }),
  },
}));
