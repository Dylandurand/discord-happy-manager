import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHappyTest } from '@/commands/happyTest';

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn<[], boolean>().mockReturnValue(true),
  replyEphemeral: vi.fn().mockResolvedValue(undefined),
  getContentItem: vi.fn().mockResolvedValue({
    id: 'mot-001',
    category: 'motivation',
    text: 'Message de test',
    provider: 'local',
  }),
  formatMessage: vi.fn().mockReturnValue('💪 **Kick-off du jour**\n\nMessage de test'),
}));

vi.mock('@/utils/commandHelpers', () => ({
  isAdmin: mocks.isAdmin,
  replyEphemeral: mocks.replyEphemeral,
}));

vi.mock('@/content', () => ({
  getContentItem: mocks.getContentItem,
}));

vi.mock('@/content/formatter', () => ({
  formatMessage: mocks.formatMessage,
}));

vi.mock('discord.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('discord.js')>();
  return {
    ...actual,
    EmbedBuilder: vi.fn().mockImplementation(() => ({
      setTitle: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      setFooter: vi.fn().mockReturnThis(),
      setTimestamp: vi.fn().mockReturnThis(),
      addFields: vi.fn().mockReturnThis(),
    })),
  };
});

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    guild: { id: 'guild-001', name: 'Test Guild' },
    user: { id: 'user-123', tag: 'Admin#0001' },
    channelId: 'channel-123',
    replied: false,
    deferred: false,
    deferReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    options: {
      getInteger: vi.fn().mockReturnValue(null),
      getString: vi.fn().mockReturnValue(null),
    },
    ...overrides,
  } as unknown as import('discord.js').ChatInputCommandInteraction;
}

describe('/happy test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAdmin.mockReturnValue(true);
    mocks.getContentItem.mockResolvedValue({
      id: 'mot-001',
      category: 'motivation',
      text: 'Message de test',
      provider: 'local',
    });
    mocks.formatMessage.mockReturnValue('💪 **Kick-off du jour**\n\nMessage de test');
  });

  it('replies with error when guild is null', async () => {
    const interaction = makeInteraction({ guild: null });
    await executeHappyTest(interaction);
    expect(mocks.replyEphemeral).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('❌')
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('replies with error when user is not admin', async () => {
    mocks.isAdmin.mockReturnValue(false);
    const interaction = makeInteraction();
    await executeHappyTest(interaction);
    expect(mocks.replyEphemeral).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('❌')
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('defers reply ephemerally for admin', async () => {
    const interaction = makeInteraction();
    await executeHappyTest(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
  });

  it('fetches 3 items by default (null count)', async () => {
    const interaction = makeInteraction();
    await executeHappyTest(interaction);
    expect(mocks.getContentItem).toHaveBeenCalledTimes(3);
  });

  it('fetches the number of items specified by count option', async () => {
    const interaction = makeInteraction({
      options: {
        getInteger: vi.fn().mockReturnValue(2),
        getString: vi.fn().mockReturnValue(null),
      },
    });
    await executeHappyTest(interaction);
    expect(mocks.getContentItem).toHaveBeenCalledTimes(2);
  });

  it('passes requested category to getContentItem when specified', async () => {
    const interaction = makeInteraction({
      options: {
        getInteger: vi.fn().mockReturnValue(1),
        getString: vi.fn().mockReturnValue('wellbeing'),
      },
    });
    await executeHappyTest(interaction);
    expect(mocks.getContentItem).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'wellbeing' })
    );
  });

  it('editReplies with embed after fetching content', async () => {
    const interaction = makeInteraction({
      options: {
        getInteger: vi.fn().mockReturnValue(1),
        getString: vi.fn().mockReturnValue(null),
      },
    });
    await executeHappyTest(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) })
    );
  });
});
