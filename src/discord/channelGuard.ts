import { MessageFlags } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

export async function requireChannel(
  interaction: ChatInputCommandInteraction,
  channelId: string
): Promise<boolean> {
  if (interaction.channelId === channelId) return true;
  await interaction.reply({
    content: `❌ This command can only be used in <#${channelId}>.`,
    flags: MessageFlags.Ephemeral
  });
  return false;
}

