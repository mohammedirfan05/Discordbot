import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  NOTION_TOKEN: z.string().min(1),
  NOTION_PARENT_PAGE_ID: z.string().optional(),
  NOTION_USERS_DB_ID: z.string().min(1),
  NOTION_DAILY_CHECKINS_DB_ID: z.string().min(1),
  NOTION_TRADE_JOURNAL_DB_ID: z.string().min(1),
  NOTION_GOALS_DB_ID: z.string().min(1),
  NOTION_DISCIPLINE_LOGS_DB_ID: z.string().min(1),
  NOTION_REPORTS_DB_ID: z.string().min(1),
  CHANNEL_GENERAL_ID: z.string().optional(),
  CHANNEL_RESOURCES_ID: z.string().optional(),
  CHANNEL_DAILY_CHECK_IN_ID: z.string().min(1),
  CHANNEL_TRADE_JOURNAL_ID: z.string().min(1),
  CHANNEL_WEEKLY_GOALS_ID: z.string().min(1),
  CHANNEL_DISCIPLINE_LOG_ID: z.string().min(1),
  CHANNEL_PROGRESS_TRACKER_ID: z.string().min(1),
  CHANNEL_REPORTS_ID: z.string().min(1),
  TIMEZONE: z.string().default("Asia/Kolkata"),
  DAILY_REPORT_CRON: z.string().default("0 22 * * *"),
  WEEKLY_REPORT_CRON: z.string().default("0 20 * * 0"),
  MONTHLY_REPORT_CRON: z.string().default("0 20 1 * *"),
  LOG_LEVEL: z.string().default("info")
});

const result = schema.safeParse(process.env);

if (!result.success) {
  const lines = result.error.issues.map((issue) => {
    const key = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `- ${key}: ${issue.message}`;
  });

  throw new Error(
    [
      "Environment configuration is invalid.",
      "Set the missing or invalid variables in Railway or your local .env file:",
      ...lines
    ].join("\n")
  );
}

export const env = result.data;

