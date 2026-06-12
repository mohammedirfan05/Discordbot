import cron from "node-cron";
import type { Client } from "discord.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { currentMonthRange, currentWeekRange, todayInTimezone } from "../domain/dateRange.js";
import type { TraderUser } from "../domain/types.js";
import type { ReportService } from "../application/reportService.js";
import type { AccountabilityService } from "../application/accountabilityService.js";
import { sendDiscordReport } from "../discord/bot.js";

export function startSchedulers(
  client: Client,
  accountability: AccountabilityService,
  reports: ReportService
): void {
  // ── Scheduled reports ────────────────────────────────────────────────────
  cron.schedule(
    env.DAILY_REPORT_CRON,
    () => runReport(client, reports, "Daily", {
      start: todayInTimezone(env.TIMEZONE), end: todayInTimezone(env.TIMEZONE)
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

  // ── Reminders (DM-first) ─────────────────────────────────────────────────
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
      { checkinCron: env.CHECKIN_REMINDER_CRON, disciplineCron: env.DISCIPLINE_REMINDER_CRON },
      "Reminder schedulers started"
    );
  } else {
    logger.info("CHANNEL_REMINDERS_ID not set — reminders disabled");
  }
}

// ── Report runner ──────────────────────────────────────────────────────────────

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

// ── DM-first reminder helper ───────────────────────────────────────────────────
// Tries to DM each user privately. Collects those with DMs disabled and falls
// back to a single channel mention for them — so nobody is silently skipped.

async function sendReminders(
  client: Client,
  users: TraderUser[],
  dmMessage: string,
  channelFallbackMessage: (mentions: string) => string
): Promise<void> {
  if (users.length === 0) return;

  const fallbackMentions: string[] = [];

  await Promise.allSettled(users.map(async user => {
    try {
      const discordUser = await client.users.fetch(user.discordUserId);
      await discordUser.send(dmMessage);
      logger.info({ userId: user.discordUserId }, "Reminder DM sent");
    } catch {
      // DMs disabled or user not found — queue for channel mention
      fallbackMentions.push(`<@${user.discordUserId}>`);
      logger.info({ userId: user.discordUserId }, "DM failed — queueing channel mention");
    }
  }));

  if (fallbackMentions.length > 0) {
    try {
      const channel = await client.channels.fetch(env.CHANNEL_REMINDERS_ID!);
      if (channel?.isSendable()) {
        await channel.send(channelFallbackMessage(fallbackMentions.join(" ")));
      }
    } catch (error) {
      logger.error({ error }, "Channel fallback reminder failed");
    }
  }
}

// ── Check-in reminder (9am Mon–Fri) ──────────────────────────────────────────

async function runCheckinReminder(
  client: Client,
  accountability: AccountabilityService
): Promise<void> {
  try {
    const today  = todayInTimezone(env.TIMEZONE);
    const missed = await accountability.getUsersMissingCheckin(today);
    logger.info({ count: missed.length }, "Check-in reminder: users missing today");

    await sendReminders(
      client,
      missed,
      `⏰ **Morning Check-In Reminder**\n\nHey! You haven't logged your check-in yet today.\n\nHead to <#${env.CHANNEL_DAILY_CHECK_IN_ID}> and use \`/checkin\` before you trade! 🎯`,
      mentions => `⏰ **Morning Check-In Reminder**\n${mentions}\n\nLog your check-in in <#${env.CHANNEL_DAILY_CHECK_IN_ID}> before you trade! 🎯`
    );
  } catch (error) {
    logger.error({ error }, "Check-in reminder failed");
  }
}

// ── Discipline reminder (6pm Mon–Fri) ─────────────────────────────────────────

async function runDisciplineReminder(
  client: Client,
  accountability: AccountabilityService
): Promise<void> {
  try {
    const today  = todayInTimezone(env.TIMEZONE);
    const missed = await accountability.getUsersMissingDiscipline(today);
    logger.info({ count: missed.length }, "Discipline reminder: users missing today");

    await sendReminders(
      client,
      missed,
      `📋 **End-of-Day Reminder**\n\nHey! Don't forget to log your discipline for today.\n\nHead to <#${env.CHANNEL_DISCIPLINE_LOG_ID}> and use \`/discipline\`. Consistency is everything. 💪`,
      mentions => `📋 **End-of-Day Reminder**\n${mentions}\n\nLog your discipline in <#${env.CHANNEL_DISCIPLINE_LOG_ID}>. Consistency is everything. 💪`
    );
  } catch (error) {
    logger.error({ error }, "Discipline reminder failed");
  }
}
