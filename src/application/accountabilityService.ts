import type { DateRange } from "../domain/dateRange.js";
import { buildStats } from "../domain/metrics.js";
import type {
  DailyCheckinInput,
  DisciplineInput,
  GoalInput,
  GoalStatus,
  TradeInput,
  TraderStats
} from "../domain/types.js";
import type { NotionRepositories } from "../infrastructure/notion/repositories.js";

export class AccountabilityService {
  constructor(private readonly repo: NotionRepositories) {}

  submitCheckin(input: DailyCheckinInput): Promise<void> {
    validateScale("Mood", input.mood);
    validateScale("Energy", input.energy);
    validateScale("Focus", input.focus);
    if (input.sleepHours < 0 || input.sleepHours > 24) throw new Error("Sleep hours must be between 0 and 24.");
    return this.repo.createDailyCheckin(input);
  }

  submitTrade(input: TradeInput) {
    if (input.riskPercent <= 0) throw new Error("Risk % must be greater than 0.");
    return this.repo.createTrade(input);
  }

  createGoal(input: GoalInput): Promise<string> {
    return this.repo.createGoal(input);
  }

  updateGoalStatus(discordUserId: string, goalId: string, status: GoalStatus): Promise<void> {
    return this.repo.updateGoalStatus(discordUserId, goalId, status);
  }

  submitDiscipline(input: DisciplineInput) {
    return this.repo.createDisciplineLog(input);
  }

  async statsForUser(discordUserId: string, range: DateRange): Promise<TraderStats> {
    const [trades, disciplineLogs, goalsCompleted, checkinCount] = await Promise.all([
      this.repo.listTrades(discordUserId, range.start, range.end),
      this.repo.listDisciplineLogs(discordUserId, range.start, range.end),
      this.repo.countCompletedGoals(discordUserId, range.start, range.end),
      this.repo.countCheckins(discordUserId, range.start, range.end)
    ]);

    return buildStats({
      discordUserId,
      trades,
      disciplineLogs,
      completedGoals: goalsCompleted,
      checkinCount,
      range
    });
  }

  async leaderboard(range: DateRange): Promise<TraderStats[]> {
    const users = await this.repo.listUsers();
    const stats = await Promise.all(users.map((user) => this.statsForUser(user.discordUserId, range)));
    return stats.sort((a, b) => traderScore(b) - traderScore(a));
  }
}

export function traderScore(stats: TraderStats): number {
  return stats.disciplineScore * 0.35
    + stats.winRate * 0.25
    + stats.checkinConsistency * 0.2
    + Math.max(0, stats.netPerformanceR) * 10
    + stats.goalsCompleted * 5;
}

function validateScale(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 1 || value > 10) {
    throw new Error(`${label} must be between 1 and 10.`);
  }
}

