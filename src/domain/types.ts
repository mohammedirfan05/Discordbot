export type Direction = "Long" | "Short";
export type TradeResult = "Win" | "Loss" | "BE" | "Open";
export type GoalStatus = "Not Started" | "In Progress" | "Completed" | "Blocked";
export type ReportType = "Daily" | "Weekly" | "Monthly";

export interface TraderUser {
  notionId: string;
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

