import type { ChatInputCommandInteraction } from "discord.js";
import { env } from "../config/env.js";
import { currentMonthRange, currentWeekRange, todayIso } from "../domain/dateRange.js";
import type { Direction, GoalStatus, TradeResult } from "../domain/types.js";
import type { AccountabilityService } from "../application/accountabilityService.js";
import { formatStats } from "../application/reportService.js";
import { requireChannel } from "./channelGuard.js";

export class InteractionHandler {
  constructor(private readonly service: AccountabilityService) {}

  async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      switch (interaction.commandName) {
        case "checkin":
          await this.checkin(interaction);
          return;
        case "trade":
          await this.trade(interaction);
          return;
        case "goal":
          await this.goal(interaction);
          return;
        case "goal-status":
          await this.goalStatus(interaction);
          return;
        case "discipline":
          await this.discipline(interaction);
          return;
        case "stats":
        case "my-week":
          await this.stats(interaction, "week");
          return;
        case "my-month":
          await this.stats(interaction, "month");
          return;
        case "leaderboard":
          await this.leaderboard(interaction);
          return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected command failure.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  }

  private async checkin(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_DAILY_CHECK_IN_ID, "#daily-check-in"))) return;
    await this.service.submitCheckin({
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      date: todayIso(),
      mood: interaction.options.getInteger("mood", true),
      sleepHours: interaction.options.getNumber("sleep_hours", true),
      energy: interaction.options.getInteger("energy", true),
      focus: interaction.options.getInteger("focus", true),
      tradingPlan: interaction.options.getString("trading_plan", true)
    });
    await interaction.reply("Check-in saved.");
  }

  private async trade(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_TRADE_JOURNAL_ID, "#trade-journal"))) return;
    const trade = await this.service.submitTrade({
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      date: todayIso(),
      pair: interaction.options.getString("pair", true),
      direction: interaction.options.getString("direction", true) as Direction,
      entry: interaction.options.getNumber("entry", true),
      stopLoss: interaction.options.getNumber("stop_loss", true),
      takeProfit: interaction.options.getNumber("take_profit", true),
      riskPercent: interaction.options.getNumber("risk_percent", true),
      result: interaction.options.getString("result", true) as TradeResult,
      screenshotUrl: interaction.options.getString("screenshot_url") ?? undefined
    });
    await interaction.reply(`Trade saved. RR: ${trade.rr}, Performance: ${trade.performanceR}R.`);
  }

  private async goal(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_WEEKLY_GOALS_ID, "#weekly-goals"))) return;
    const goalId = await this.service.createGoal({
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      goal: interaction.options.getString("goal", true),
      category: interaction.options.getString("category", true),
      deadline: interaction.options.getString("deadline", true)
    });
    await interaction.reply(`Goal created. Goal ID: \`${goalId}\`.`);
  }

  private async goalStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_WEEKLY_GOALS_ID, "#weekly-goals"))) return;
    await this.service.updateGoalStatus(
      interaction.user.id,
      interaction.options.getString("goal_id", true),
      interaction.options.getString("status", true) as GoalStatus
    );
    await interaction.reply("Goal status updated.");
  }

  private async discipline(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_DISCIPLINE_LOG_ID, "#discipline-log"))) return;
    const record = await this.service.submitDiscipline({
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
      date: todayIso(),
      followedPlan: interaction.options.getBoolean("followed_plan", true),
      revengeTraded: interaction.options.getBoolean("revenge_traded", true),
      overtraded: interaction.options.getBoolean("overtraded", true),
      brokeRiskRules: interaction.options.getBoolean("broke_risk_rules", true)
    });
    await interaction.reply(`Discipline log saved. Score: ${record.score}%.`);
  }

  private async stats(interaction: ChatInputCommandInteraction, period: "week" | "month"): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID, "#progress-tracker"))) return;
    const range = period === "week" ? currentWeekRange() : currentMonthRange();
    const stats = await this.service.statsForUser(interaction.user.id, range);
    await interaction.reply(`**${period === "week" ? "Weekly" : "Monthly"} Stats**\n${formatStats(stats)}`);
  }

  private async leaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!(await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID, "#progress-tracker"))) return;
    const stats = await this.service.leaderboard(currentWeekRange());
    const body = stats.length === 0
      ? "No active traders found."
      : stats.map((item, index) => `${index + 1}. <@${item.discordUserId}> | Discipline ${item.disciplineScore}% | Win ${item.winRate}% | Check-ins ${item.checkinConsistency}% | Net ${item.netPerformanceR}R`).join("\n");
    await interaction.reply(`**Weekly Leaderboard**\n${body}`);
  }
}

