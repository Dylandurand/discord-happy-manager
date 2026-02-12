/**
 * Command Helper Utilities
 *
 * Common utilities for slash command implementations.
 * Handles permission checks, channel access, and user responses.
 *
 * @remarks
 * These utilities reduce code duplication across command handlers.
 *
 * @example
 * ```typescript
 * import { isAdmin, replyEphemeral } from '@/utils/commandHelpers';
 *
 * if (!isAdmin(interaction)) {
 *   return replyEphemeral(interaction, '❌ Admin only');
 * }
 * ```
 */

import type {
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
  PermissionResolvable,
} from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { client } from '@/bot/client';

/**
 * Checks if a user is an administrator.
 *
 * @param interaction - Command interaction
 *
 * @returns True if user has Administrator permission
 *
 * @example
 * ```typescript
 * if (!isAdmin(interaction)) {
 *   return replyEphemeral(interaction, '❌ Admin only');
 * }
 * ```
 */
export function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.guild || !interaction.member) {
    return false;
  }

  const member = interaction.member as GuildMember;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Checks if a user has a specific permission.
 *
 * @param interaction - Command interaction
 * @param permission - Permission to check
 *
 * @returns True if user has the permission
 *
 * @example
 * ```typescript
 * if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
 *   return replyEphemeral(interaction, '❌ Insufficient permissions');
 * }
 * ```
 */
export function hasPermission(
  interaction: ChatInputCommandInteraction,
  permission: PermissionResolvable
): boolean {
  if (!interaction.guild || !interaction.member) {
    return false;
  }

  const member = interaction.member as GuildMember;
  return member.permissions.has(permission);
}

/**
 * Gets a text channel by ID.
 *
 * @param guildId - Guild (server) ID
 * @param channelId - Channel ID
 *
 * @returns TextChannel or null if not found or not accessible
 *
 * @example
 * ```typescript
 * const channel = getGuildChannel('123', '456');
 * if (channel) {
 *   await channel.send('Hello!');
 * }
 * ```
 */
export function getGuildChannel(
  guildId: string,
  channelId: string
): TextChannel | null {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      return null;
    }

    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return null;
    }

    return channel as TextChannel;
  } catch {
    return null;
  }
}

/**
 * Sends an ephemeral reply (only visible to command user).
 *
 * @param interaction - Command interaction
 * @param message - Message to send
 *
 * @returns Promise resolving when reply is sent
 *
 * @remarks
 * Ephemeral messages are perfect for error messages and confirmations.
 *
 * @example
 * ```typescript
 * await replyEphemeral(interaction, '✅ Settings updated!');
 * ```
 */
export async function replyEphemeral(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.reply({
    content: message,
    ephemeral: true,
  });
}

/**
 * Sends a public reply (visible to everyone).
 *
 * @param interaction - Command interaction
 * @param message - Message to send
 *
 * @returns Promise resolving when reply is sent
 *
 * @example
 * ```typescript
 * await replyPublic(interaction, 'Message sent!');
 * ```
 */
export async function replyPublic(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.reply({
    content: message,
    ephemeral: false,
  });
}

/**
 * Defers a reply (shows "Bot is thinking..." state).
 *
 * @param interaction - Command interaction
 * @param ephemeral - Whether the eventual reply should be ephemeral
 *
 * @returns Promise resolving when defer is sent
 *
 * @remarks
 * Use this for commands that take > 3 seconds to process.
 * Discord requires a response within 3 seconds.
 *
 * @example
 * ```typescript
 * await deferReply(interaction, true);
 * // Do slow operation...
 * await interaction.editReply('Done!');
 * ```
 */
export async function deferReply(
  interaction: ChatInputCommandInteraction,
  ephemeral: boolean = true
): Promise<void> {
  await interaction.deferReply({ ephemeral });
}

/**
 * Formats a duration in seconds to human-readable string.
 *
 * @param seconds - Duration in seconds
 *
 * @returns Formatted string (e.g., "2m 30s", "1h 5m")
 *
 * @example
 * ```typescript
 * formatDuration(150); // "2m 30s"
 * formatDuration(3665); // "1h 1m 5s"
 * ```
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  let result = `${hours}h`;
  if (remainingMinutes > 0) {
    result += ` ${remainingMinutes}m`;
  }
  if (remainingSeconds > 0) {
    result += ` ${remainingSeconds}s`;
  }

  return result;
}
