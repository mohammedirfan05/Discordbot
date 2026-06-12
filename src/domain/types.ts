export type Direction = "Long" | "Short";
export type TradeResult = "Win" | "Loss" | "BE" | "Open";
export type GoalStatus = "Not Started" | "In Progress" | "Completed" | "Blocked";
export type ReportType = "Daily" | "Weekly" | "Monthly";

export interface ActiveGoal {
  goalId: string;
  goalText: string;
  status: GoalStatus;
  deadline: string;
}

export interface TraderUser {
  discordUserId: string;
  discordUsername: string;
}

export interface DailyCheckinInput {
  discordUserId: string;
  discordUsername: string;
  date: string;
  mood: number;
  sleepHours: number;
  energy: number;
  focus: number;
  tradingPlan: string;
}

export interface TradeInput {
  discordUserId: string;
  discordUsername: string;
  date: string;
  pair: string;
  direction: Direction;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  result: TradeResult;
  screenshotUrl?: string;
}

export interface GoalInput {
  discordUserId: string;
  discordUsername: string;
  goal: string;
  category: string;
  deadline: string;
}

export interface DisciplineInput {
  discordUserId: string;
  discordUsername: string;
  date: string;
  followedPlan: boolean;
  revengeTraded: boolean;
  overtraded: boolean;
  brokeRiskRules: boolean;
}

export interface TradeRecord extends TradeInput {
  rr: number;
  performanceR: number;
}

export interface DisciplineRecord extends DisciplineInput {
  score: number;
}

export interface TraderStats {
  discordUserId: string;
  totalTrades: number;
  winRate: number;
  averageRr: number;
  netPerformanceR: number;
  disciplineScore: number;
  goalsCompleted: number;
  checkinConsistency: number;
}

// ── Learning Sessions ─────────────────────────────────────────────────────────

export interface LearningSession {
  id: string;
  discordUserId: string;
  topic: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
}

export interface LearningStats {
  totalSessions: number;
  totalMinutes: number;
  thisWeekMinutes: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
}

// ── Streaks ───────────────────────────────────────────────────────────────────

export interface StreakData {
  checkinCurrent: number;
  checkinBest: number;
  disciplineCurrent: number;
  disciplineBest: number;
}
