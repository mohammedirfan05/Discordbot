import "dotenv/config";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { z } from "zod";
import { commandDefinitions } from "./commandDefinitions.js";

const env = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1)
}).parse(process.env);

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
  { body: commandDefinitions }
);

console.log(`Registered ${commandDefinitions.length} guild slash commands.`);

