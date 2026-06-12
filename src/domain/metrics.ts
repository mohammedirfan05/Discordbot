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

// ── Streak helpers ────────────────────────────────────────────────────────────

/** Shifts a YYYY-MM-DD date string by `days` (negative = backwards). */
export function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the length of the active streak ending today or yesterday.
 * `sortedDesc` must be a deduplicated array of YYYY-MM-DD strings, newest first.
 */
export function currentStreak(sortedDesc: string[], today: string): number {
  if (sortedDesc.length === 0) return 0;
  const yesterday = offsetDate(today, -1);
  // Must touch today or yesterday to be "active"
  if (sortedDesc[0] !== today && sortedDesc[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sortedDesc.length; i++) {
    if (sortedDesc[i] === offsetDate(sortedDesc[i - 1], -1)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Returns the longest consecutive run in any array of YYYY-MM-DD strings. */
export function longestStreak(sortedDesc: string[]): number {
  if (sortedDesc.length === 0) return 0;
  let best = 1;
  let cur  = 1;
  for (let i = 1; i < sortedDesc.length; i++) {
    if (sortedDesc[i] === offsetDate(sortedDesc[i - 1], -1)) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}
