import { calculateRr, disciplineScore, tradePerformanceR } from "../../domain/metrics.js";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export class SupabaseRepositories {
  constructor(private readonly db: SB) {}

  // ── Users ────────────────────────────────────────────────────────────────────

  async ensureUser(discordUserId: string, discordUsername: string): Promise<void> {
    const { error } = await this.db
      .from("users")
      .upsert(
        { discord_user_id: discordUserId, discord_username: discordUsername, active: true },
        { onConflict: "discord_user_id" }
      );
    if (error) throw new Error(error.message);
  }

  async listUsers(): Promise<TraderUser[]> {
    const { data, error } = await this.db
      .from("users")
      .select("discord_user_id, discord_username")
      .eq("active", true);
    if (error) throw new Error(error.message);
    return ((data as any[]) ?? []).map(r => ({
      discordUserId:   r.discord_user_id  as string,
      discordUsername: r.discord_username as string
    }));
  }

  // ── Daily Check-ins ──────────────────────────────────────────────────────────

  async createDailyCheckin(input: DailyCheckinInput): Promise<void> {
    await this.ensureUser(input.discordUserId, input.discordUsername);
    const { error } = await this.db.from("daily_checkins").insert({
      discord_user_id: input.discordUserId,
      date:            input.date,
      mood:            input.mood,
      sleep_hours:     input.sleepHours,
      energy:          input.energy,
      focus:           input.focus,
      trading_plan:    input.tradingPlan
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("You already submitted a check-in today. Come back tomorrow! 📅");
      }
      throw new Error(error.message);
    }
  }

  async findDailyCheckin(discordUserId: string, day: string): Promise<boolean> {
    const { count, error } = await this.db
      .from("daily_checkins")
      .select("id", { count: "exact", head: true })
      .eq("discord_user_id", discordUserId)
      .eq("date", day);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }

  async countCheckins(discordUserId: string, start: string, end: string): Promise<number> {
    const { count, error } = await this.db
      .from("daily_checkins")
      .select("id", { count: "exact", head: true })
      .eq("discord_user_id", discordUserId)
      .gte("date", start)
      .lte("date", end);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  // ── Trade Journal ────────────────────────────────────────────────────────────

  async createTrade(input: TradeInput): Promise<TradeRecord> {
    await this.ensureUser(input.discordUserId, input.discordUsername);
    const rr = calculateRr(input.entry, input.stopLoss, input.takeProfit);
    const { error } = await this.db.from("trades").insert({
      discord_user_id: input.discordUserId,
      date:            input.date,
      pair:            input.pair,
      direction:       input.direction,
      entry:           input.entry,
      stop_loss:       input.stopLoss,
      take_profit:     input.takeProfit,
      risk_percent:    input.riskPercent,
      result:          input.result,
      screenshot_url:  input.screenshotUrl ?? null
    });
    if (error) throw new Error(error.message);
    return { ...input, rr, performanceR: tradePerformanceR({ result: input.result, rr }) };
  }

  async listTrades(discordUserId: string, start: string, end: string): Promise<TradeRecord[]> {
    const { data, error } = await this.db
      .from("trades")
      .select("*")
      .eq("discord_user_id", discordUserId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data as any[]) ?? []).map(r => {
      let rr = 0;
      try { rr = calculateRr(r.entry, r.stop_loss, r.take_profit); } catch { /* SL === entry */ }
      const result = r.result as TradeRecord["result"];
      return {
        discordUserId:   r.discord_user_id as string,
        discordUsername: "",
        date:            r.date            as string,
        pair:            r.pair            as string,
        direction:       r.direction       as TradeRecord["direction"],
        entry:           r.entry           as number,
        stopLoss:        r.stop_loss       as number,
        takeProfit:      r.take_profit     as number,
        riskPercent:     r.risk_percent    as number,
        result,
        screenshotUrl:   (r.screenshot_url as string | null) ?? undefined,
        rr,
        performanceR:    tradePerformanceR({ result, rr })
      };
    });
  }

  // ── Goals ────────────────────────────────────────────────────────────────────

  async createGoal(input: GoalInput): Promise<string> {
    await this.ensureUser(input.discordUserId, input.discordUsername);
    const goalId = `${input.discordUserId}-${Date.now()}`;
    const { error } = await this.db.from("goals").insert({
      goal_id:         goalId,
      discord_user_id: input.discordUserId,
      goal_text:       input.goal,
      category:        input.category,
      deadline:        input.deadline,
      status:          "Not Started"
    });
    if (error) throw new Error(error.message);
    return goalId;
  }

  async updateGoalStatus(discordUserId: string, goalId: string, nextStatus: GoalStatus): Promise<void> {
    const update: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "Completed") update["completed_at"] = new Date().toISOString();

    const { error, data } = await this.db
      .from("goals")
      .update(update)
      .eq("goal_id", goalId)
      .eq("discord_user_id", discordUserId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || (data as any[]).length === 0) {
      throw new Error("Goal not found. Make sure you selected the right goal.");
    }
  }

  async listActiveGoals(discordUserId: string): Promise<ActiveGoal[]> {
    const { data, error } = await this.db
      .from("goals")
      .select("goal_id, goal_text, status, deadline")
      .eq("discord_user_id", discordUserId)
      .in("status", ["Not Started", "In Progress", "Blocked"])
      .order("deadline", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data as any[]) ?? []).map(r => ({
      goalId:   r.goal_id   as string,
      goalText: r.goal_text as string,
      status:   r.status    as GoalStatus,
      deadline: r.deadline  as string
    }));
  }

  async countCompletedGoals(discordUserId: string, start: string, end: string): Promise<number> {
    const { count, error } = await this.db
      .from("goals")
      .select("id", { count: "exact", head: true })
      .eq("discord_user_id", discordUserId)
      .eq("status", "Completed")
      .gte("deadline", start)
      .lte("deadline", end);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  // ── Discipline Logs ──────────────────────────────────────────────────────────

  async createDisciplineLog(input: DisciplineInput): Promise<DisciplineRecord> {
    await this.ensureUser(input.discordUserId, input.discordUsername);
    const score = disciplineScore(input);
    const { error } = await this.db.from("discipline_logs").insert({
      discord_user_id:  input.discordUserId,
      date:             input.date,
      followed_plan:    input.followedPlan,
      revenge_traded:   input.revengeTraded,
      overtraded:       input.overtraded,
      broke_risk_rules: input.brokeRiskRules
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("You already submitted a discipline log today. See you tomorrow! 📅");
      }
      throw new Error(error.message);
    }
    return { ...input, score };
  }

  async findDisciplineLog(discordUserId: string, day: string): Promise<boolean> {
    const { count, error } = await this.db
      .from("discipline_logs")
      .select("id", { count: "exact", head: true })
      .eq("discord_user_id", discordUserId)
      .eq("date", day);
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }

  async listDisciplineLogs(discordUserId: string, start: string, end: string): Promise<DisciplineRecord[]> {
    const { data, error } = await this.db
      .from("discipline_logs")
      .select("*")
      .eq("discord_user_id", discordUserId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data as any[]) ?? []).map(r => {
      const base = {
        discordUserId:   r.discord_user_id  as string,
        discordUsername: "",
        date:            r.date             as string,
        followedPlan:    r.followed_plan    as boolean,
        revengeTraded:   r.revenge_traded   as boolean,
        overtraded:      r.overtraded       as boolean,
        brokeRiskRules:  r.broke_risk_rules as boolean
      };
      return { ...base, score: disciplineScore(base) };
    });
  }

  // ── Reports ──────────────────────────────────────────────────────────────────

  async createReport(type: string, start: string, end: string, content: string): Promise<void> {
    const { error } = await this.db.from("reports").insert({
      type,
      period_start: start,
      period_end:   end,
      content
    });
    if (error) throw new Error(error.message);
  }
}
