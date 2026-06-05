import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { AccountabilityService } from "./application/accountabilityService.js";
import { ReportService } from "./application/reportService.js";
import { createDiscordClient } from "./discord/bot.js";
import { InteractionHandler } from "./discord/interactionHandler.js";
import { startSchedulers } from "./jobs/scheduler.js";
import { notion } from "./infrastructure/notion/client.js";
import { NotionRepositories } from "./infrastructure/notion/repositories.js";

const repo = new NotionRepositories(notion);
const accountability = new AccountabilityService(repo);
const reports = new ReportService(accountability, repo);
const handler = new InteractionHandler(accountability);
const client = createDiscordClient(handler);

startSchedulers(client, reports);

await client.login(env.DISCORD_TOKEN);

process.on("unhandledRejection", (error) => {
  logger.error({ error }, "Unhandled rejection");
});

process.on("uncaughtException", (error) => {
  logger.error({ error }, "Uncaught exception");
  process.exit(1);
});

