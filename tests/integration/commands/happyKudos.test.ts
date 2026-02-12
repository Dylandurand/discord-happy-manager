import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHappyKudos } from '@/commands/happyKudos';

const mocks = vi.hoisted(() => ({
  getRemainingMs: vi.fn<[], number>().mockReturnValue(0),
  setWithDuration: vi.fn(),
  guildConfigGet: vi.fn().mockReturnValue(null),
}));

vi.mock('@/db', () => ({
  cooldownRepo: {
    getRemainingMs: mocks.getRemainingMs,
    isOnCooldown: vi.fn().mockReturnValue(false),
    setWithDuration: mocks.setWithDuration,
  },
  guildConfigRepo: {
    get: mocks.guildConfigGet,
  },
  sentRepo: { record: vi.fn() },
  getDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}));

const TARGET_USER = { id: 'target-456', tag: 'Target#0002', bot: false };
const SENDER_ID = 'user-123';

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    guild: {
      id: 'guild-001',
      name: 'Test Guild',
      members: {
        fetch: vi.fn().mockResolvedValue({ toString: () => '<@target-456>' }),
      },
      channels: { cache: new Map() },
    },
    user: { id: SENDER_ID, tag: 'Sender#0001' },
    channelId: 'channel-123',
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    options: {
      getUser: vi.fn().mockReturnValue(TARGET_USER),
      getString: vi.fn().mockReturnValue(null),
    },
    ...overrides,
  } as unknown as import('discord.js').ChatInputCommandInteraction;
}

describe('/happy kudos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRemainingMs.mockReturnValue(0);
  });

  it('defers reply when no cooldown and valid inputs', async () => {
    const interaction = makeInteraction();
    await executeHappyKudos(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('replies ephemerally when on cooldown', async () => {
    mocks.getRemainingMs.mockReturnValue(120_000);
    const interaction = makeInteraction();
    await executeHappyKudos(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true })
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('rejects self-kudos', async () => {
    const interaction = makeInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: SENDER_ID, tag: 'Sender#0001', bot: false }),
        getString: vi.fn().mockReturnValue(null),
      },
    });
    await executeHappyKudos(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('😅') })
    );
  });

  it('rejects kudos to bots', async () => {
    const interaction = makeInteraction({
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'bot-789', tag: 'Bot#0000', bot: true }),
        getString: vi.fn().mockReturnValue(null),
      },
    });
    await executeHappyKudos(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('🤖') })
    );
  });

  it('rejects message exceeding 120 chars', async () => {
    const interaction = makeInteraction({
      options: {
        getUser: vi.fn().mockReturnValue(TARGET_USER),
        getString: vi.fn().mockReturnValue('a'.repeat(121)),
      },
    });
    await executeHappyKudos(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('❌') })
    );
  });

  it('sends kudos message with 🎉 emoji on success', async () => {
    const interaction = makeInteraction();
    await executeHappyKudos(interaction);
    expect(interaction.followUp).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('🎉'),
        ephemeral: false,
      })
    );
  });

  it('sets cooldown after successful delivery', async () => {
    const interaction = makeInteraction();
    await executeHappyKudos(interaction);
    expect(mocks.setWithDuration).toHaveBeenCalledWith(`user:${SENDER_ID}:kudos`, expect.any(Number));
  });

  it('replies with error when guild is null', async () => {
    const interaction = makeInteraction({ guild: null });
    await executeHappyKudos(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('❌') })
    );
  });
});
