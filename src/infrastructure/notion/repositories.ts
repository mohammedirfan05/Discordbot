import type { Client } from "@notionhq/client";
import { env } from "../../config/env.js";
import type {
  ActiveGoal,
  DailyCheckinInput,
  DisciplineInput,
  DisciplineRecord,
  GoalInput,
  GoalStatus,
  TradeInput,
  TradeRecord,
  TraderUser
} from "../../domain/types.js";
import { calculateRr, disciplineScore, tradePerformanceR } from "../../domain/metrics.js";
import {
  bool,
  checkbox,
  date,
  numeric,
  pageDate,
  plainText,
  relation,
  richText,
  selected,
  select,
  status,
  title,
  url
} from "./notionProps.js";

type Page = any;

export class NotionRepositories {
  constructor(private readonly client: Client) {}

  // ── Pagination ────────────────────────────────────────────────────────────
  // Notion returns at most 100 results per request. This helper follows the
  // cursor until all pages are retrieved so stats are never silently truncated.

  private async queryAll(params: Parameters<Client["databases"]["query"]>[0]): Promise<Page[]> {
    const results: Page[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.client.databases.query({
        ...params,
        start_cursor: cursor,
        page_size: 100
      });
      results.push(...(res.results as Page[]));
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return results;
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async ensureUser(discordUserId: string, discordUsername: string): Promise<TraderUser> {
    const existing = await this.findUser(discordUserId);
    if (existing) return existing;

    const page = await this.client.pages.create({
      parent: { database_id: env.NOTION_USERS_DB_ID },
      properties: {
        Name: title(discordUsername),
        "Discord User ID": richText(discordUserId),
        "Discord Username": richText(discordUsername),
        Active: checkbox(true),
        "Joined At": date(new Date().toISOString())
      }
    });

    return { notionId: page.id, discordUserId, discordUsername };
  }

  async findUser(discordUserId: string): Promise<TraderUser | null> {
    const result = await this.client.databases.query({
      database_id: env.NOTION_USERS_DB_ID,
      filter: { property: "Discord User ID", rich_text: { equals: discordUserId } }
    });
    const page = result.results[0] as Page | undefined;
    if (!page) return null;
    return {
      notionId: page.id,
      discordUserId,
      discordUsername: plainText(page.properties["Discord Username"])
    };
  }

  async listUsers(): Promise<TraderUser[]> {
    const pages = await this.queryAll({
      database_id: env.NOTION_USERS_DB_ID,
      filter: { property: "Active", checkbox: { equals: true } }
    });
    return pages.map((page: Page) => ({
      notionId: page.id,
      discordUserId: plainText(page.properties["Discord User ID"]),
      discordUsername: plainText(page.properties["Discord Username"])
    }));
  }

  // ── Daily Check-ins ───────────────────────────────────────────────────────

  async createDailyCheckin(input: DailyCheckinInput): Promise<void> {
    const duplicate = await this.findDailyCheckin(input.discordUserId, input.date);
    if (duplicate) throw new Error("You already submitted a check-in today. Come back tomorrow! 📅");
    const user = await this.ensureUser(input.discordUserId, input.discordUsername);

    await this.client.pages.create({
      parent: { database_id: env.NOTION_DAILY_CHECKINS_DB_ID },
      properties: {
        "Checkin ID": title(`${input.discordUserId}:${input.date}`),
        User: relation(user.notionId),
        "Discord User ID": richText(input.discordUserId),
        Date: date(input.date),
        Mood: { number: input.mood },
        "Sleep Hours": { number: input.sleepHours },
        Energy: { number: input.energy },
        Focus: { number: input.focus },
        "Trading Plan": richText(input.tradingPlan)
      }
    });
  }

  async findDailyCheckin(discordUserId: string, day: string): Promise<Page | null> {
    const result = await this.client.databases.query({
      database_id: env.NOTION_DAILY_CHECKINS_DB_ID,
      filter: {
        and: [
          { property: "Discord User ID", rich_text: { equals: discordUserId } },
          { property: "Date", date: { equals: day } }
        ]
      }
    });
    return (result.results[0] as Page | undefined) ?? null;
  }

  async countCheckins(discordUserId: string, start: string, end: string): Promise<number> {
    const pages = await this.queryAll({
      database_id: env.NOTION_DAILY_CHECKINS_DB_ID,
      filter: dateRangeFilter(discordUserId, start, end)
    });
    return pages.length;
  }

  // ── Trade Journal ─────────────────────────────────────────────────────────

  async createTrade(input: TradeInput): Promise<TradeRecord> {
    const user = await this.ensureUser(input.discordUserId, input.discordUsername);
    const rr = calculateRr(input.entry, input.stopLoss, input.takeProfit);
    const record = { ...input, rr, performanceR: tradePerformanceR({ result: input.result, rr }) };

    await this.client.pages.create({
      parent: { database_id: env.NOTION_TRADE_JOURNAL_DB_ID },
      properties: {
        "Trade ID": title(`${input.discordUserId}:${input.date}:${input.pair}:${Date.now()}`),
        User: relation(user.notionId),
        "Discord User ID": richText(input.discordUserId),
        Date: date(input.date),
        Pair: select(input.pair.toUpperCase()),
        Direction: select(input.direction),
        Entry: { number: input.entry },
        "Stop Loss": { number: input.stopLoss },
        "Take Profit": { number: input.takeProfit },
        "Risk %": { number: input.riskPercent },
        Result: select(input.result),
        "Screenshot URL": url(input.screenshotUrl)
      }
    });

    return record;
  }

  async listTrades(discordUserId: string, start: string, end: string): Promise<TradeRecord[]> {
    const pages = await this.queryAll({
      database_id: env.NOTION_TRADE_JOURNAL_DB_ID,
      filter: dateRangeFilter(discordUserId, start, end)
    });

    return pages.map((page: Page) => {
      // BUG FIX: Compute RR from stored numeric fields instead of the Notion
      // formula column, which returns 0 when read back via the API.
      const entry      = numeric(page.properties.Entry);
      const stopLoss   = numeric(page.properties["Stop Loss"]);
      const takeProfit = numeric(page.properties["Take Profit"]);
      let rr = 0;
      try { rr = calculateRr(entry, stopLoss, takeProfit); } catch { /* SL === entry edge case */ }

      const result = selected(page.properties.Result) as TradeRecord["result"];
      const record = {
        discordUserId,
        discordUsername: "",
        date: pageDate(page.properties.Date),
        pair: selected(page.properties.Pair),
        direction: selected(page.properties.Direction) as TradeRecord["direction"],
        entry,
        stopLoss,
        takeProfit,
        riskPercent: numeric(page.properties["Risk %"]),
        result,
        screenshotUrl: page.properties["Screenshot URL"]?.url ?? undefined,
        rr
      };
      return { ...record, performanceR: tradePerformanceR({ result, rr }) };
    });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────

  async createGoal(input: GoalInput): Promise<string> {
    const user = await this.ensureUser(input.discordUserId, input.discordUsername);
    const goalId = `${input.discordUserId}-${Date.now()}`;

    await this.client.pages.create({
      parent: { database_id: env.NOTION_GOALS_DB_ID },
      properties: {
        Goal: title(input.goal),
        "Goal ID": richText(goalId),
        User: relation(user.notionId),
        "Discord User ID": richText(input.discordUserId),
        Category: select(input.category),
        Deadline: date(input.deadline),
        Status: status("Not Started"),
        "Created At": date(new Date().toISOString())
      }
    });

    return goalId;
  }

  async updateGoalStatus(discordUserId: string, goalId: string, nextStatus: GoalStatus): Promise<void> {
    const result = await this.client.databases.query({
      database_id: env.NOTION_GOALS_DB_ID,
      filter: {
        and: [
          { property: "Discord User ID", rich_text: { equals: discordUserId } },
          { property: "Goal ID", rich_text: { equals: goalId } }
        ]
      }
    });
    const page = result.results[0] as Page | undefined;
    if (!page) throw new Error("Goal not found. Make sure you selected the right goal.");

    await this.client.pages.update({
      page_id: page.id,
      properties: {
        Status: status(nextStatus),
        "Completed At": nextStatus === "Completed"
          ? date(new Date().toISOString())
          : { date: null }
      }
    });
  }

  // Returns non-completed goals for the /goal-status autocomplete handler.
  async listActiveGoals(discordUserId: string): Promise<ActiveGoal[]> {
    const pages = await this.queryAll({
      database_id: env.NOTION_GOALS_DB_ID,
      filter: {
        and: [
          { property: "Discord User ID", rich_text: { equals: discordUserId } },
          {
            or: [
              { property: "Status", status: { equals: "Not Started" } },
              { property: "Status", status: { equals: "In Progress" } },
              { property: "Status", status: { equals: "Blocked" } }
            ]
          }
        ]
      }
    });

    return pages.map((page: Page) => ({
      goalId:   plainText(page.properties["Goal ID"]),
      goalText: plainText(page.properties["Goal"]),
      status:   selected(page.properties.Status) as GoalStatus,
      deadline: pageDate(page.properties.Deadline)
    }));
  }

  async countCompletedGoals(discordUserId: string, start: string, end: string): Promise<number> {
    const pages = await this.queryAll({
      database_id: env.NOTION_GOALS_DB_ID,
      filter: {
        and: [
          { property: "Discord User ID", rich_text: { equals: discordUserId } },
          { property: "Deadline", date: { on_or_after: start } },
          { property: "Deadline", date: { on_or_before: end } },
          { property: "Status", status: { equals: "Completed" } }
        ]
      }
    });
    return pages.length;
  }

  // ── Discipline Logs ───────────────────────────────────────────────────────

  async createDisciplineLog(input: DisciplineInput): Promise<DisciplineRecord> {
    const duplicate = await this.findDisciplineLog(input.discordUserId, input.date);
    if (duplicate) throw new Error("You already submitted a discipline log today. See you tomorrow! 📅");
    const user = await this.ensureUser(input.discordUserId, input.discordUsername);
    const score = disciplineScore(input);
    const record = { ...input, score };

    await this.client.pages.create({
      parent: { database_id: env.NOTION_DISCIPLINE_LOGS_DB_ID },
      properties: {
        "Discipline ID": title(`${input.discordUserId}:${input.date}`),
        User: relation(user.notionId),
        "Discord User ID": richText(input.discordUserId),
        Date: date(input.date),
        "Followed Plan": checkbox(input.followedPlan),
        "Revenge Traded": checkbox(input.revengeTraded),
        Overtraded: checkbox(input.overtraded),
        "Broke Risk Rules": checkbox(input.brokeRiskRules)
      }
    });

    return record;
  }

  async findDisciplineLog(discordUserId: string, day: string): Promise<Page | null> {
    const result = await this.client.databases.query({
      database_id: env.NOTION_DISCIPLINE_LOGS_DB_ID,
      filter: {
        and: [
          { property: "Discord User ID", rich_text: { equals: discordUserId } },
          { property: "Date", date: { equals: day } }
        ]
      }
    });
    return (result.results[0] as Page | undefined) ?? null;
  }

  async listDisciplineLogs(discordUserId: string, start: string, end: string): Promise<DisciplineRecord[]> {
    const pages = await this.queryAll({
      database_id: env.NOTION_DISCIPLINE_LOGS_DB_ID,
      filter: dateRangeFilter(discordUserId, start, end)
    });

    return pages.map((page: Page) => {
      // BUG FIX: Compute score from boolean fields instead of the Notion
      // formula column, which returns 0 when read back via the API.
      const followedPlan   = bool(page.properties["Followed Plan"]);
      const revengeTraded  = bool(page.properties["Revenge Traded"]);
      const overtraded     = bool(page.properties.Overtraded);
      const brokeRiskRules = bool(page.properties["Broke Risk Rules"]);
      const base = {
        discordUserId,
        discordUsername: "",
        date: pageDate(page.properties.Date),
        followedPlan,
        revengeTraded,
        overtraded,
        brokeRiskRules
      };
      return { ...base, score: disciplineScore(base) };
    });
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async createReport(type: string, start: string, end: string, content: string): Promise<void> {
    await this.client.pages.create({
      parent: { database_id: env.NOTION_REPORTS_DB_ID },
      properties: {
        "Report ID": title(`${type}:${start}:${end}`),
        Type: select(type),
        "Period Start": date(start),
        "Period End": date(end),
        "Generated At": date(new Date().toISOString()),
        Content: richText(content)
      }
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateRangeFilter(discordUserId: string, start: string, end: string) {
  return {
    and: [
      { property: "Discord User ID", rich_text: { equals: discordUserId } },
      { property: "Date", date: { on_or_after: start } },
      { property: "Date", date: { on_or_before: end } }
    ]
  };
}
