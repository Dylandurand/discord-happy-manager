import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHappyNow } from '@/commands/happyNow';

// vi.hoisted ensures these mocks are available when vi.mock factory runs
const mocks = vi.hoisted(() => ({
  getRemainingMs: vi.fn<[], number>().mockReturnValue(0),
  isOnCooldown: vi.fn<[], boolean>().mockReturnValue(false),
  setWithDuration: vi.fn(),
  delete: vi.fn(),
  guildConfigGet: vi.fn().mockReturnValue(null),
  getFormattedContent: vi.fn().mockResolvedValue({
    message: '💪 **Kick-off du jour**\n\nMessage de test',
    item: { id: 'mot-001', category: 'motivation', text: 'Message de test', provider: 'local' },
  }),
  recordSentContent: vi.fn(),
}));

vi.mock('@/db', () => ({
  cooldownRepo: {
    getRemainingMs: mocks.getRemainingMs,
    isOnCooldown: mocks.isOnCooldown,
    setWithDuration: mocks.setWithDuration,
    delete: mocks.delete,
  },
  guildConfigRepo: {
    get: mocks.guildConfigGet,
  },
  sentRepo: { record: vi.fn() },
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}));

vi.mock('@/content', () => ({
  getFormattedContent: mocks.getFormattedContent,
  recordSentContent: mocks.recordSentContent,
}));

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    guild: {
      id: 'guild-001',
      name: 'Test Guild',
      channels: { cache: new Map() },
    },
    user: { id: 'user-123', tag: 'TestUser#0001' },
    channelId: 'channel-123',
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    options: { getString: vi.fn().mockReturnValue(null) },
    ...overrides,
  } as unknown as import('discord.js').ChatInputCommandInteraction;
}

describe('/happy now', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemainingMs.mockReturnValue(0);
    mocks.getFormattedContent.mockResolvedValue({
      message: '💪 **Kick-off du jour**\n\nMessage de test',
      item: { id: 'mot-001', category: 'motivation', text: 'Message de test', provider: 'local' },
    });
  });

  it('defers reply when no cooldown', async () => {
    const interaction = makeInteraction();
    await executeHappyNow(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('replies ephemerally when on cooldown', async () => {
    mocks.getRemainingMs.mockReturnValue(30_000); // 30 seconds remaining
    const interaction = makeInteraction();
    await executeHappyNow(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('replies with error when guild is null', async () => {
    const interaction = makeInteraction({ guild: null });
    await executeHappyNow(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('❌') })
    );
  });

  it('passes category to getFormattedContent when option provided', async () => {
    const interaction = makeInteraction({
      options: { getString: vi.fn().mockReturnValue('motivation') },
    });
    await executeHappyNow(interaction);
    expect(mocks.getFormattedContent).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'motivation' })
    );
  });

  it('sets cooldown after successful delivery', async () => {
    const interaction = makeInteraction();
    await executeHappyNow(interaction);
    expect(mocks.setWithDuration).toHaveBeenCalledWith('guild:guild-001:now', expect.any(Number));
  });
});
