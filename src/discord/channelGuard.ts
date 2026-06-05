import type { ChatInputCommandInteraction } from "discord.js";

export async function requireChannel(
  interaction: ChatInputCommandInteraction,
  channelId: string,
  channelLabel: string
): Promise<boolean> {
  if (interaction.channelId === channelId) return true;
  await interaction.reply({
    content: `Use this command in ${channelLabel}.`,
    ephemeral: true
  });
  return false;
}

