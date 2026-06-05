import type { DateRange } from "../domain/dateRange.js";
import type { ReportType, TraderStats } from "../domain/types.js";
import type { AccountabilityService } from "./accountabilityService.js";
import { traderScore } from "./accountabilityService.js";
import type { NotionRepositories } from "../infrastructure/notion/repositories.js";

export class ReportService {
  constructor(
    private readonly accountability: AccountabilityService,
    private readonly repo: NotionRepositories
  ) {}

  async generate(type: ReportType, range: DateRange): Promise<string> {
    const stats = await this.accountability.leaderboard(range);
    const content = formatReport(type, range, stats);
    await this.repo.createReport(type, range.start, range.end, content);
    return content;
  }
}

export function formatStats(stats: TraderStats): string {
  return [
    `Discipline Score: ${stats.disciplineScore}%`,
    `Win Rate: ${stats.winRate}%`,
    `Goals Completed: ${stats.goalsCompleted}`,
    `Check-In Consistency: ${stats.checkinConsistency}%`,
    `Total Trades: ${stats.totalTrades}`,
    `Average RR: ${stats.averageRr}`,
    `Net Performance: ${stats.netPerformanceR}R`
  ].join("\n");
}

function formatReport(type: ReportType, range: DateRange, stats: TraderStats[]): string {
  const header = `**${type} Trading Accountability Report**\nPeriod: ${range.start} to ${range.end}`;
  if (stats.length === 0) return `${header}\n\nNo active traders found.`;

  const lines = stats.map((item, index) => [
    `${index + 1}. <@${item.discordUserId}> | Score: ${Math.round(traderScore(item))}`,
    `Discipline ${item.disciplineScore}% | Win Rate ${item.winRate}% | Goals ${item.goalsCompleted} | Check-ins ${item.checkinConsistency}% | Net ${item.netPerformanceR}R`
  ].join("\n"));

  return `${header}\n\n${lines.join("\n\n")}`;
}

