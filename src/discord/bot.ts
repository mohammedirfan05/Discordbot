import { Client, GatewayIntentBits, type SendableChannels } from "discord.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import type { InteractionHandler } from "./interactionHandler.js";

export function createDiscordClient(handler: InteractionHandler): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once("ready", () => {
    logger.info({ user: client.user?.tag }, "Discord bot ready");
  });

  // Route ALL interaction types — not just slash commands.
  // Autocomplete, button clicks, and modal submissions are handled
  // by InteractionHandler.handle() which discriminates via type guards.
  client.on("interactionCreate", async (interaction) => {
    await handler.handle(interaction);
  });

  return client;
}

export async function sendDiscordReport(client: Client, content: string): Promise<void> {
  const channel = await client.channels.fetch(env.CHANNEL_REPORTS_ID);
  if (!channel?.isSendable()) {
    throw new Error("Configured report channel cannot receive bot messages.");
  }
  await sendChunked(channel, content);
}

async function sendChunked(channel: SendableChannels, content: string): Promise<void> {
  const chunks = content.match(/[\s\S]{1,1900}/g) ?? [content];
  for (const chunk of chunks) {
    await channel.send(chunk);
  }
}
