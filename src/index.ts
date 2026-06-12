import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRepositories } from "./infrastructure/supabase/repositories.js";
import { AccountabilityService } from "./application/accountabilityService.js";
import { ReportService } from "./application/reportService.js";
import { createDiscordClient } from "./discord/bot.js";
import { InteractionHandler } from "./discord/interactionHandler.js";
import { startSchedulers } from "./jobs/scheduler.js";

// Supabase client — service-role key gives full server-side access
const supabase       = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const repo           = new SupabaseRepositories(supabase);
const accountability = new AccountabilityService(repo);
const reports        = new ReportService(accountability, repo);
const handler        = new InteractionHandler(accountability);
const client         = createDiscordClient(handler);

// Start schedulers inside ready so channels are guaranteed to be fetchable
client.once("ready", () => {
  startSchedulers(client, accountability, reports);
  logger.info("All systems running ✅");
});

await client.login(env.DISCORD_TOKEN);

process.on("unhandledRejection", (error) => {
  logger.error({ error }, "Unhandled rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});
