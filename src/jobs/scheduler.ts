import cron from "node-cron";
import type { Client } from "discord.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { currentMonthRange, currentWeekRange, todayInTimezone } from "../domain/dateRange.js";
import type { ReportService } from "../application/reportService.js";
import type { AccountabilityService } from "../application/accountabilityService.js";
import { sendDiscordReport } from "../discord/bot.js";

export function startSchedulers(
  client: Client,
  accountability: AccountabilityService,
  reports: ReportService
): void {
  // ── Scheduled Reports ──────────────────────────────────────────────────────
  cron.schedule(
    env.DAILY_REPORT_CRON,
    () => runReport(client, reports, "Daily", {
      start: todayInTimezone(env.TIMEZONE),
      end:   todayInTimezone(env.TIMEZONE)
    }),
    { timezone: env.TIMEZONE }
  );

  cron.schedule(
    env.WEEKLY_REPORT_CRON,
    () => runReport(client, reports, "Weekly", currentWeekRange()),
    { timezone: env.TIMEZONE }
  );

  cron.schedule(
    env.MONTHLY_REPORT_CRON,
    () => runReport(client, reports, "Monthly", currentMonthRange()),
    { timezone: env.TIMEZONE }
  );

  // ── Reminders — only active when CHANNEL_REMINDERS_ID is configured ─────────
  if (env.CHANNEL_REMINDERS_ID) {
    cron.schedule(
      env.CHECKIN_REMINDER_CRON,
      () => runCheckinReminder(client, accountability),
      { timezone: env.TIMEZONE }
    );

    cron.schedule(
      env.DISCIPLINE_REMINDER_CRON,
      () => runDisciplineReminder(client, accountability),
      { timezone: env.TIMEZONE }
    );

    logger.info(
      {
        checkinCron:    env.CHECKIN_REMINDER_CRON,
        disciplineCron: env.DISCIPLINE_REMINDER_CRON
      },
      "Reminder schedulers started"
    );
  } else {
    logger.info("CHANNEL_REMINDERS_ID not set — reminders disabled");
  }
}

// ── Report runner ─────────────────────────────────────────────────────────────

async function runReport(
  client: Client,
  reports: ReportService,
  type: "Daily" | "Weekly" | "Monthly",
  range: { start: string; end: string }
): Promise<void> {
  try {
    const content = await reports.generate(type, range);
    await sendDiscordReport(client, content);
    logger.info({ type, range }, "Report sent");
  } catch (error) {
    logger.error({ error, type, range }, "Scheduled report failed");
  }
}

// ── Check-in reminder ─────────────────────────────────────────────────────────
// Runs on CHECKIN_REMINDER_CRON (default: 9am weekdays).
// Mentions only users who have not yet submitted a check-in today.

async function runCheckinReminder(
  client: Client,
  accountability: AccountabilityService
): Promise<void> {
  try {
    const today  = todayInTimezone(env.TIMEZONE);
    const missed = await accountability.getUsersMissingCheckin(today);
    if (missed.length === 0) return;

    const channel = await client.channels.fetch(env.CHANNEL_REMINDERS_ID!);
    if (!channel?.isSendable()) {
      logger.warn("Reminders channel is not sendable — skipping check-in reminder");
      return;
    }

    const mentions = missed.map(u => `<@${u.discordUserId}>`).join(" ");
    await channel.send(
      `⏰ **Morning Check-In Reminder**\n${mentions}\n\n` +
      `Start your day strong — log your check-in in <#${env.CHANNEL_DAILY_CHECK_IN_ID}> before you trade! 🎯`
    );
    logger.info({ count: missed.length }, "Check-in reminder sent");
  } catch (error) {
    logger.error({ error }, "Check-in reminder failed");
  }
}

// ── Discipline reminder ───────────────────────────────────────────────────────
// Runs on DISCIPLINE_REMINDER_CRON (default: 6pm weekdays).
// Mentions only users who have not yet submitted a discipline log today.

async function runDisciplineReminder(
  client: Client,
  accountability: AccountabilityService
): Promise<void> {
  try {
    const today  = todayInTimezone(env.TIMEZONE);
    const missed = await accountability.getUsersMissingDiscipline(today);
    if (missed.length === 0) return;

    const channel = await client.channels.fetch(env.CHANNEL_REMINDERS_ID!);
    if (!channel?.isSendable()) {
      logger.warn("Reminders channel is not sendable — skipping discipline reminder");
      return;
    }

    const mentions = missed.map(u => `<@${u.discordUserId}>`).join(" ");
    await channel.send(
      `📋 **End-of-Day Reminder**\n${mentions}\n\n` +
      `Don't forget to log your discipline in <#${env.CHANNEL_DISCIPLINE_LOG_ID}>. Consistency is everything. 💪`
    );
    logger.info({ count: missed.length }, "Discipline reminder sent");
  } catch (error) {
    logger.error({ error }, "Discipline reminder failed");
  }
}
