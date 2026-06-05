import type { DateRange } from "./dateRange.js";
import { daysInclusive } from "./dateRange.js";
import type { DisciplineRecord, TradeRecord, TraderStats } from "./types.js";

export function calculateRr(entry: number, stopLoss: number, takeProfit: number): number {
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) {
    throw new Error("Entry and stop loss cannot be equal.");
  }
  return round2(Math.abs(takeProfit - entry) / risk);
}

export function tradePerformanceR(trade: Pick<TradeRecord, "result" | "rr">): number {
  if (trade.result === "Win") return trade.rr;
  if (trade.result === "Loss") return -1;
  return 0;
}

export function disciplineScore(record: Omit<DisciplineRecord, "score">): number {
  return [
    record.followedPlan,
    !record.revengeTraded,
    !record.overtraded,
    !record.brokeRiskRules
  ].filter(Boolean).length * 25;
}

export function buildStats(args: {
  discordUserId: string;
  trades: TradeRecord[];
  disciplineLogs: DisciplineRecord[];
  completedGoals: number;
  checkinCount: number;
  range: DateRange;
}): TraderStats {
  const closedTrades = args.trades.filter((trade) => trade.result !== "Open");
  const wins = closedTrades.filter((trade) => trade.result === "Win").length;
  const totalRr = args.trades.reduce((sum, trade) => sum + trade.rr, 0);
  const totalPerformance = args.trades.reduce((sum, trade) => sum + trade.performanceR, 0);
  const totalDiscipline = args.disciplineLogs.reduce((sum, log) => sum + log.score, 0);

  return {
    discordUserId: args.discordUserId,
    totalTrades: args.trades.length,
    winRate: closedTrades.length === 0 ? 0 : round2((wins / closedTrades.length) * 100),
    averageRr: args.trades.length === 0 ? 0 : round2(totalRr / args.trades.length),
    netPerformanceR: round2(totalPerformance),
    disciplineScore: args.disciplineLogs.length === 0 ? 0 : round2(totalDiscipline / args.disciplineLogs.length),
    goalsCompleted: args.completedGoals,
    checkinConsistency: round2((args.checkinCount / daysInclusive(args.range)) * 100)
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

