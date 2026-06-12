import type { DateRange } from "../domain/dateRange.js";
import { buildStats, currentStreak, longestStreak, offsetDate } from "../domain/metrics.js";
import { currentWeekRange, todayInTimezone } from "../domain/dateRange.js";
import { env } from "../config/env.js";
import type {
  ActiveGoal,
  DailyCheckinInput,
  DisciplineInput,
  GoalInput,
  GoalStatus,
  LearningSession,
  LearningStats,
  StreakData,
  TradeInput,
  TraderStats,
  TraderUser
} from "../domain/types.js";
import type { SupabaseRepositories } from "../infrastructure/supabase/repositories.js";

export class AccountabilityService {
  constructor(private readonly repo: SupabaseRepositories) {}

  // ── Core commands ──────────────────────────────────────────────────────────

  submitCheckin(input: DailyCheckinInput): Promise<void> {
    validateScale("Mood",   input.mood);
    validateScale("Energy", input.energy);
    validateScale("Focus",  input.focus);
    if (input.sleepHours < 0 || input.sleepHours > 24) {
      throw new Error("Sleep hours must be between 0 and 24.");
    }
    return this.repo.createDailyCheckin(input);
  }

  submitTrade(input: TradeInput) {
    validateTrade(input);
    return this.repo.createTrade(input);
  }

  createGoal(input: GoalInput): Promise<string> {
    validateDeadline(input.deadline);
    return this.repo.createGoal(input);
  }

  updateGoalStatus(discordUserId: string, goalId: string, goalStatus: GoalStatus): Promise<void> {
    return this.repo.updateGoalStatus(discordUserId, goalId, goalStatus);
  }

  submitDiscipline(input: DisciplineInput) {
    return this.repo.createDisciplineLog(input);
  }

  // ── Stats & leaderboard ───────────────────────────────────────────────────

  async statsForUser(discordUserId: string, range: DateRange): Promise<TraderStats> {
    const [trades, disciplineLogs, goalsCompleted, checkinCount] = await Promise.all([
      this.repo.listTrades(discordUserId, range.start, range.end),
      this.repo.listDisciplineLogs(discordUserId, range.start, range.end),
      this.repo.countCompletedGoals(discordUserId, range.start, range.end),
      this.repo.countCheckins(discordUserId, range.start, range.end)
    ]);
    return buildStats({ discordUserId, trades, disciplineLogs, completedGoals: goalsCompleted, checkinCount, range });
  }

  async leaderboard(range: DateRange): Promise<TraderStats[]> {
    const users = await this.repo.listUsers();
    const stats = await Promise.all(users.map(u => this.statsForUser(u.discordUserId, range)));
    return stats.sort((a, b) => traderScore(b) - traderScore(a));
  }

  // ── Streaks ───────────────────────────────────────────────────────────────

  async getStreaks(discordUserId: string): Promise<StreakData> {
    const today = todayInTimezone(env.TIMEZONE);
    const since = offsetDate(today, -365); // full year of history for best-streak

    const [checkinDates, disciplineDates] = await Promise.all([
      this.repo.getCheckinDates(discordUserId, since),
      this.repo.getDisciplineDates(discordUserId, since)
    ]);

    return {
      checkinCurrent:    currentStreak(checkinDates,   today),
      checkinBest:       longestStreak(checkinDates),
      disciplineCurrent: currentStreak(disciplineDates, today),
      disciplineBest:    longestStreak(disciplineDates)
    };
  }

  // ── History ───────────────────────────────────────────────────────────────

  async recentTrades(discordUserId: string, days: number) {
    const today = todayInTimezone(env.TIMEZONE);
    const since = offsetDate(today, -(days - 1));
    return this.repo.listTrades(discordUserId, since, today);
  }

  // ── Goals autocomplete ────────────────────────────────────────────────────

  listActiveGoals(discordUserId: string): Promise<ActiveGoal[]> {
    return this.repo.listActiveGoals(discordUserId);
  }

  // ── Learning sessions ─────────────────────────────────────────────────────

  startLearning(discordUserId: string, discordUsername: string, topic?: string): Promise<string> {
    return this.repo.startLearningSession(discordUserId, discordUsername, topic);
  }

  stopLearning(discordUserId: string): Promise<LearningSession> {
    return this.repo.stopLearningSession(discordUserId);
  }

  getLearningStats(discordUserId: string): Promise<LearningStats> {
    return this.repo.getLearningStats(discordUserId, currentWeekRange().start);
  }

  findActiveLearning(discordUserId: string) {
    return this.repo.findActiveLearningSession(discordUserId);
  }

  // ── Reminders ─────────────────────────────────────────────────────────────

  async getUsersMissingCheckin(date: string): Promise<TraderUser[]> {
    const users  = await this.repo.listUsers();
    const checks = await Promise.all(users.map(u => this.repo.findDailyCheckin(u.discordUserId, date)));
    return users.filter((_, i) => !checks[i]);
  }

  async getUsersMissingDiscipline(date: string): Promise<TraderUser[]> {
    const users  = await this.repo.listUsers();
    const checks = await Promise.all(users.map(u => this.repo.findDisciplineLog(u.discordUserId, date)));
    return users.filter((_, i) => !checks[i]);
  }
}

export function traderScore(stats: TraderStats): number {
  return stats.disciplineScore * 0.35
    + stats.winRate * 0.25
    + stats.checkinConsistency * 0.2
    + Math.max(0, stats.netPerformanceR) * 10
    + stats.goalsCompleted * 5;
}

// ── Validators ────────────────────────────────────────────────────────────────

function validateScale(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    throw new Error(`${label} must be between 1 and 10.`);
  }
}

function validateTrade(input: TradeInput): void {
  if (input.direction === "Long") {
    if (input.stopLoss >= input.entry)   throw new Error("Long trade: stop loss must be **below** your entry price.");
    if (input.takeProfit <= input.entry) throw new Error("Long trade: take profit must be **above** your entry price.");
  } else {
    if (input.stopLoss <= input.entry)   throw new Error("Short trade: stop loss must be **above** your entry price.");
    if (input.takeProfit >= input.entry) throw new Error("Short trade: take profit must be **below** your entry price.");
  }
  if (input.screenshotUrl) {
    try { new URL(input.screenshotUrl); }
    catch { throw new Error("Screenshot URL must be a valid web address (e.g., https://...)."); }
  }
}

function validateDeadline(deadline: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    throw new Error("Deadline must be in YYYY-MM-DD format (e.g., 2026-06-15).");
  }
  const d = new Date(`${deadline}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new Error("Deadline is not a valid calendar date.");
}
