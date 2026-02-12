/**
 * Interaction Handler
 *
 * Routes Discord interactions (slash commands, buttons, modals) to appropriate handlers.
 * Central error handling for all interactions.
 *
 * @remarks
 * - Handles ChatInputCommand (slash commands)
 * - Future: Button, Modal, SelectMenu interactions
 * - Global error handling and logging
 *
 * @example
 * ```typescript
 * import { setupInteractionHandlers } from '@/bot/interactionHandler';
 *
 * setupInteractionHandlers();
 * // Now client will handle all interactions
 * ```
 */

import { Events } from 'discord.js';
import type { Interaction } from 'discord.js';
import { client } from './client';
import { executeHappyNow } from '@/commands/happyNow';
import { executeHappySettings } from '@/commands/happySettings';
import { executeHappyTest } from '@/commands/happyTest';
import { executeHappyKudos } from '@/commands/happyKudos';

/**
 * Sets up interaction event handlers on the Discord client.
 *
 * @remarks
 * Call this once after client initialization.
 * Attaches handlers for all interaction types.
 *
 * @example
 * ```typescript
 * await initializeClient();
 * setupInteractionHandlers();
 * ```
 */
export function setupInteractionHandlers(): void {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction);
      return;
    }

    // Future: Handle button interactions
    // if (interaction.isButton()) {
    //   await handleButton(interaction);
    //   return;
    // }

    // Future: Handle modal submissions
    // if (interaction.isModalSubmit()) {
    //   await handleModal(interaction);
    //   return;
    // }
  });

  console.log('✅ Interaction handlers registered');
}

/**
 * Handles slash command interactions.
 *
 * @param interaction - Chat input command interaction
 *
 * @remarks
 * Routes to specific command handlers based on command name and subcommand.
 * Catches and logs all errors to prevent bot crashes.
 */
async function handleChatInputCommand(
  interaction: Interaction
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    const { commandName } = interaction;

    // Route to /happy subcommands
    if (commandName === 'happy') {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'now':
          await executeHappyNow(interaction);
          break;

        case 'settings':
          await executeHappySettings(interaction);
          break;

        case 'test':
          await executeHappyTest(interaction);
          break;

        case 'kudos':
          await executeHappyKudos(interaction);
          break;

        default:
          await interaction.reply({
            content: '❌ Unknown subcommand',
            ephemeral: true,
          });
      }
    } else {
      // Unknown command
      await interaction.reply({
        content: '❌ Unknown command',
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('❌ Error handling command interaction:', error);

    // Try to respond with error message
    try {
      const errorMessage = '❌ An error occurred while executing this command.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error('❌ Failed to send error message to user:', replyError);
    }
  }
}
