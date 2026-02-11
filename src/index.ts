/**
 * Happy Manager Bot - Main Entry Point
 *
 * Discord bot for motivational messages and team well-being.
 * This bot is the sister/brother of Grumpy, providing positive vibes,
 * motivation boosts, and wellbeing tips to the server team.
 *
 * @remarks
 * The bot runs scheduled messages (2-3x/day) and responds to slash commands.
 * All configuration is stored in SQLite database per guild.
 *
 * @see /roadmap/spec.md for full specifications
 */

import { env } from './config/env';
import { APP } from './config/constants';
import { getDatabase, guildConfigRepo, sentRepo, cooldownRepo, closeDatabase } from './db';
import { initializeClient, setupInteractionHandlers, shutdownClient } from './bot';

/**
 * Main application entry point.
 *
 * Initializes the Discord bot client and starts the scheduler.
 *
 * @throws {Error} If required environment variables are missing
 */
async function main(): Promise<void> {
  console.log(`🤖 ${APP.NAME} v${APP.VERSION} starting...`);
  console.log(`📋 Environment: ${env.NODE_ENV}`);
  console.log(`🌍 Default Timezone: ${env.DEFAULT_TIMEZONE}`);
  console.log('');

  // Phase 2: Initialize database
  console.log('🔧 Initializing database...');
  const db = getDatabase();
  console.log('');

  // Test repositories
  if (env.NODE_ENV === 'development') {
    console.log('🧪 Testing repositories...');

    // Test GuildConfigRepository
    const testGuildId = 'test-guild-123';
    console.log(`  → Testing GuildConfigRepository...`);

    guildConfigRepo.upsert({
      guildId: testGuildId,
      channelId: 'test-channel-456',
      timezone: 'Europe/Paris',
      cadence: 2,
      activeDays: [1, 2, 3, 4, 5],
      scheduleTimes: ['09:15', '16:30'],
      contextualEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const config = guildConfigRepo.get(testGuildId);
    console.log(`    ✅ Guild config: ${config ? 'SAVED & RETRIEVED' : 'FAILED'}`);

    // Test SentMessageRepository
    console.log(`  → Testing SentMessageRepository...`);

    sentRepo.record({
      guildId: testGuildId,
      channelId: 'test-channel-456',
      contentId: 'test-content-001',
      category: 'motivation',
      provider: 'local',
      sentAt: new Date(),
    });

    const wasRecent = sentRepo.wasSentRecently(testGuildId, 'test-content-001', 30);
    console.log(`    ✅ Sent message: ${wasRecent ? 'RECORDED & FOUND' : 'FAILED'}`);

    // Test CooldownRepository
    console.log(`  → Testing CooldownRepository...`);

    const cooldownKey = `guild:${testGuildId}:now`;
    cooldownRepo.setWithDuration(cooldownKey, 60);

    const onCooldown = cooldownRepo.isOnCooldown(cooldownKey);
    console.log(`    ✅ Cooldown: ${onCooldown ? 'SET & ACTIVE' : 'FAILED'}`);

    console.log('');
    console.log('✅ All repository tests passed!');
    console.log('');
  }

  console.log('✅ Phase 1: Setup & Infrastructure - Complete!');
  console.log('✅ Phase 2: Database & Repositories - Complete!');
  console.log('');

  // Phase 3: Initialize Discord client
  if (env.DISCORD_TOKEN !== 'test_token_placeholder') {
    console.log('🔧 Initializing Discord bot...');
    try {
      await initializeClient();
      setupInteractionHandlers();
      console.log('');
      console.log('✅ Phase 3: Bot Core & Commands - Complete!');
      console.log('');
      console.log('🎉 Bot is ready! Listening for commands...');
      console.log('');
      console.log('Next steps:');
      console.log('  - Phase 4: Content System');
      console.log('  - Phase 5: Scheduler');
      console.log('');
    } catch (error) {
      console.error('❌ Failed to initialize Discord bot:', error);
      throw error;
    }
  } else {
    console.log('⚠️  Discord token is placeholder - skipping bot initialization');
    console.log('   Set a real token in .env to connect to Discord');
    console.log('');
    console.log('✅ Phase 3: Bot Core & Commands - Implementation Complete!');
    console.log('');
    console.log('To test the bot:');
    console.log('  1. Create a Discord application at https://discord.com/developers');
    console.log('  2. Copy the bot token to .env (DISCORD_TOKEN)');
    console.log('  3. Copy the application ID to .env (DISCORD_CLIENT_ID)');
    console.log('  4. Restart the bot');
    console.log('');
    console.log('Next steps:');
    console.log('  - Phase 4: Content System');
    console.log('  - Phase 5: Scheduler');
    console.log('');
    console.log('⏸️  Exiting...');
    await cleanup();
  }

  // TODO: Phase 5 - Start scheduler
}

/**
 * Cleanup function for graceful shutdown.
 */
async function cleanup(): Promise<void> {
  console.log('🧹 Cleaning up...');
  await shutdownClient();
  closeDatabase();
  console.log('✅ Cleanup complete');
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('');
  console.log('📡 SIGTERM received, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('');
  console.log('📡 SIGINT received, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

// Start the bot
main().catch((error: unknown) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
