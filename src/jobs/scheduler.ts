import cron from "node-cron";
import type { Client } from "discord.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { currentMonthRange, currentWeekRange, todayIso } from "../domain/dateRange.js";
import type { ReportService } from "../application/reportService.js";
import { sendDiscordReport } from "../discord/bot.js";

export function startSchedulers(client: Client, reports: ReportService): void {
  cron.schedule(env.DAILY_REPORT_CRON, () => runReport(client, reports, "Daily", { start: todayIso(), end: todayIso() }), {
    timezone: env.TIMEZONE
  });

  cron.schedule(env.WEEKLY_REPORT_CRON, () => runReport(client, reports, "Weekly", currentWeekRange()), {
    timezone: env.TIMEZONE
  });

  cron.schedule(env.MONTHLY_REPORT_CRON, () => runReport(client, reports, "Monthly", currentMonthRange()), {
    timezone: env.TIMEZONE
  });
}

async function runReport(
  client: Client,
  reports: ReportService,
  type: "Daily" | "Weekly" | "Monthly",
  range: { start: string; end: string }
): Promise<void> {
  try {
    const content = await reports.generate(type, range);
    await sendDiscordReport(client, content);
  } catch (error) {
    logger.error({ error, type, range }, "Scheduled report failed");
  }
}

