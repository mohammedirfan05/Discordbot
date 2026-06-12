import {
  type Interaction,
  type ChatInputCommandInteraction,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from "discord.js";
import { env } from "../config/env.js";
import { currentMonthRange, currentWeekRange, todayInTimezone } from "../domain/dateRange.js";
import { disciplineScore } from "../domain/metrics.js";
import type { Direction, GoalStatus, TradeResult } from "../domain/types.js";
import type { AccountabilityService } from "../application/accountabilityService.js";
import { traderScore } from "../application/accountabilityService.js";
import { requireChannel } from "./channelGuard.js";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  checkin:    0x5DE8A5,
  trade:      0x5865F2,
  goal:       0x9B59B6,
  discipline: 0xF0C040,
  stats:      0x3498DB,
  learn:      0xE67E22,
  streak:     0xFF6B35,
  error:      0xE74C3C,
  info:       0x95A5A6
} as const;

const MEDALS = ["🥇", "🥈", "🥉"];

// ── Pending state stores ──────────────────────────────────────────────────────

interface PendingCheckin {
  mood: number; sleepHours: number; energy: number; focus: number;
  expiresAt: number;
}

interface PendingTrade {
  pair: string; direction: Direction; result: TradeResult;
  expiresAt: number;
}

interface PendingDiscipline {
  followedPlan: boolean; revengeTraded: boolean; overtraded: boolean; brokeRiskRules: boolean;
  expiresAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function progressBar(value: number, max: number, width = 10): string {
  const filled = Math.min(Math.round((Math.max(value, 0) / Math.max(max, 1)) * width), width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export class InteractionHandler {
  private readonly pendingCheckins   = new Map<string, PendingCheckin>();
  private readonly pendingTrades     = new Map<string, PendingTrade>();
  private readonly pendingDiscipline = new Map<string, PendingDiscipline>();

  constructor(private readonly service: AccountabilityService) {
    // Purge stale entries every 5 min to prevent memory leaks
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.pendingCheckins)   if (v.expiresAt < now) this.pendingCheckins.delete(k);
      for (const [k, v] of this.pendingTrades)     if (v.expiresAt < now) this.pendingTrades.delete(k);
      for (const [k, v] of this.pendingDiscipline) if (v.expiresAt < now) this.pendingDiscipline.delete(k);
    }, 5 * 60 * 1000);
  }

  // ── Main router ───────────────────────────────────────────────────────────

  async handle(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) return this.handleCommand(interaction);
    if (interaction.isAutocomplete())     return this.handleAutocomplete(interaction);
    if (interaction.isButton())           return this.handleButton(interaction);
    if (interaction.isModalSubmit())      return this.handleModal(interaction);
  }

  // ── Slash command dispatch ────────────────────────────────────────────────

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      switch (interaction.commandName) {
        case "checkin":     return await this.checkin(interaction);
        case "trade":       return await this.trade(interaction);
        case "goal":        return await this.goal(interaction);
        case "goal-status": return await this.goalStatus(interaction);
        case "discipline":  return await this.discipline(interaction);
        case "stats":       return await this.statsSnapshot(interaction);
        case "my-week":     return await this.statsFullPeriod(interaction, "week");
        case "my-month":    return await this.statsFullPeriod(interaction, "month");
        case "leaderboard": return await this.leaderboard(interaction);
        case "streak":      return await this.streak(interaction);
        case "history":     return await this.history(interaction);
        case "learn":       return await this.learn(interaction);
        case "help":        return await this.help(interaction);
      }
    } catch (error) {
      await this.replyError(interaction, error);
    }
  }

  private async replyError(
    interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction,
    error: unknown
  ): Promise<void> {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    const embed   = new EmbedBuilder().setColor(C.error).setDescription(`❌ ${message}`);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
    } catch { /* swallow double-reply */ }
  }

  // ── Check-In — Step 1 ─────────────────────────────────────────────────────

  private async checkin(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_DAILY_CHECK_IN_ID)) return;
    const mood       = interaction.options.getInteger("mood",       true);
    const sleepHours = interaction.options.getNumber("sleep_hours", true);
    const energy     = interaction.options.getInteger("energy",     true);
    const focus      = interaction.options.getInteger("focus",      true);

    this.pendingCheckins.set(interaction.user.id, {
      mood, sleepHours, energy, focus,
      expiresAt: Date.now() + 10 * 60_000
    });

    const readiness      = Math.round((mood + energy + focus) / 3);
    const readinessLabel = readiness >= 8 ? "🔥 High" : readiness >= 5 ? "✅ Good" : "⚠️ Low";

    const embed = new EmbedBuilder()
      .setColor(C.checkin)
      .setTitle("📊 Check-In — Step 1 of 2")
      .setDescription("Numbers saved! Hit **Add Trading Plan** to finish.")
      .addFields(
        { name: "😊 Mood",      value: `**${mood}**/10`,       inline: true },
        { name: "😴 Sleep",     value: `**${sleepHours}**h`,   inline: true },
        { name: "⚡ Energy",    value: `**${energy}**/10`,     inline: true },
        { name: "🎯 Focus",     value: `**${focus}**/10`,      inline: true },
        { name: "🧠 Readiness", value: readinessLabel,         inline: true }
      )
      .setFooter({ text: "Expires in 10 minutes." });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("checkin_plan_btn").setLabel("📝 Add Trading Plan").setStyle(ButtonStyle.Primary)
    );
    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }

  // ── Trade — Step 1: show modal for price inputs ───────────────────────────

  private async trade(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_TRADE_JOURNAL_ID)) return;

    const pair      = interaction.options.getString("pair",      true);
    const direction = interaction.options.getString("direction", true) as Direction;
    const result    = interaction.options.getString("result",    true) as TradeResult;

    this.pendingTrades.set(interaction.user.id, {
      pair, direction, result,
      expiresAt: Date.now() + 10 * 60_000
    });

    const modal = new ModalBuilder()
      .setCustomId("trade_modal")
      .setTitle(`${pair} ${direction} — Enter Prices`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("entry")
          .setLabel("Entry Price").setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder("e.g. 21000")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("stop_loss")
          .setLabel("Stop Loss").setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder("e.g. 20950")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("take_profit")
          .setLabel("Take Profit").setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder("e.g. 21100")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("risk_percent")
          .setLabel("Risk % (e.g. 1 = 1% of account)").setStyle(TextInputStyle.Short).setRequired(true)
          .setPlaceholder("e.g. 1")
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("screenshot_url")
          .setLabel("Screenshot URL (optional)").setStyle(TextInputStyle.Short).setRequired(false)
          .setPlaceholder("https://...")
      )
    );

    await interaction.showModal(modal);
  }

  // ── Discipline — show confirmation before saving ──────────────────────────

  private async discipline(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_DISCIPLINE_LOG_ID)) return;

    const followedPlan   = interaction.options.getBoolean("followed_plan",    true);
    const revengeTraded  = interaction.options.getBoolean("revenge_traded",   true);
    const overtraded     = interaction.options.getBoolean("overtraded",       true);
    const brokeRiskRules = interaction.options.getBoolean("broke_risk_rules", true);

    this.pendingDiscipline.set(interaction.user.id, {
      followedPlan, revengeTraded, overtraded, brokeRiskRules,
      expiresAt: Date.now() + 5 * 60_000
    });

    const preview = disciplineScore({
      discordUserId: interaction.user.id, discordUsername: "", date: "",
      followedPlan, revengeTraded, overtraded, brokeRiskRules
    });

    const embed = new EmbedBuilder()
      .setColor(preview >= 75 ? 0x2ECC71 : preview >= 50 ? C.discipline : C.error)
      .setTitle("📋 Confirm Discipline Log")
      .setDescription("Review your answers below. Click **Submit** to save.")
      .addFields(
        { name: "📌 Followed Plan",    value: followedPlan   ? "✅ Yes" : "❌ No",   inline: true },
        { name: "🎭 Revenge Traded",   value: revengeTraded  ? "❌ Yes" : "✅ No",   inline: true },
        { name: "📈 Overtraded",       value: overtraded     ? "❌ Yes" : "✅ No",   inline: true },
        { name: "⚠️ Broke Risk Rules", value: brokeRiskRules ? "❌ Yes" : "✅ No",   inline: true },
        { name: "🏆 Score Preview",    value: `**${preview}%**`,                     inline: true }
      )
      .setFooter({ text: "Expires in 5 minutes." });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("disc_confirm").setLabel("✅ Submit").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("disc_cancel").setLabel("❌ Cancel").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }

  // ── Goal ──────────────────────────────────────────────────────────────────

  private async goal(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_WEEKLY_GOALS_ID)) return;
    await interaction.deferReply();

    const goalText = interaction.options.getString("goal",     true);
    const category = interaction.options.getString("category", true);
    const deadline = interaction.options.getString("deadline", true);

    const goalId = await this.service.createGoal({
      discordUserId: interaction.user.id, discordUsername: interaction.user.username,
      goal: goalText, category, deadline
    });

    const embed = new EmbedBuilder()
      .setColor(C.goal)
      .setAuthor({ name: `${interaction.user.displayName}'s Goal`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("🎯 Goal Created")
      .addFields(
        { name: "📌 Goal",      value: goalText,         inline: false },
        { name: "🏷️ Category", value: category,          inline: true  },
        { name: "📅 Deadline",  value: deadline,          inline: true  },
        { name: "🆔 Goal ID",   value: `\`${goalId}\``,  inline: false }
      )
      .setFooter({ text: "Use /goal-status to track progress — autocomplete finds this goal." })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Goal Status ───────────────────────────────────────────────────────────

  private async goalStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_WEEKLY_GOALS_ID)) return;
    await interaction.deferReply();

    const goalId    = interaction.options.getString("goal_id", true);
    const newStatus = interaction.options.getString("status",  true) as GoalStatus;
    await this.service.updateGoalStatus(interaction.user.id, goalId, newStatus);

    const statusEmoji: Record<GoalStatus, string> = {
      "Not Started": "⏳", "In Progress": "🔄", "Completed": "✅", "Blocked": "⛔"
    };
    const embed = new EmbedBuilder()
      .setColor(newStatus === "Completed" ? 0x2ECC71 : newStatus === "Blocked" ? C.error : C.goal)
      .setTitle(`${statusEmoji[newStatus]} Goal Updated`)
      .setDescription(`Status changed to **${newStatus}**`)
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Stats — snapshot ──────────────────────────────────────────────────────

  private async statsSnapshot(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();
    const range = currentWeekRange();
    const s     = await this.service.statsForUser(interaction.user.id, range);
    const embed = new EmbedBuilder()
      .setColor(C.stats)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("⚡ Quick Stats — This Week")
      .addFields(
        { name: "📋 Discipline", value: `**${s.disciplineScore}%**`, inline: true },
        { name: "🏆 Win Rate",   value: `**${s.winRate}%**`,         inline: true },
        { name: "💰 Net P&L",    value: `**${s.netPerformanceR}R**`, inline: true }
      )
      .setFooter({ text: `${range.start} → ${range.end} · /my-week for full breakdown` })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Stats — full period ───────────────────────────────────────────────────

  private async statsFullPeriod(
    interaction: ChatInputCommandInteraction, period: "week" | "month"
  ): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();
    const range = period === "week" ? currentWeekRange() : currentMonthRange();
    const s     = await this.service.statsForUser(interaction.user.id, range);
    const embed = new EmbedBuilder()
      .setColor(C.stats)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`📊 ${period === "week" ? "Weekly" : "Monthly"} Report`)
      .addFields(
        { name: "📋 Discipline",      value: `${s.disciplineScore}%`,   inline: true },
        { name: "🏆 Win Rate",        value: `${s.winRate}%`,           inline: true },
        { name: "📈 Avg RR",          value: `1:${s.averageRr}`,        inline: true },
        { name: "💰 Net Performance", value: `${s.netPerformanceR}R`,   inline: true },
        { name: "🎯 Goals Done",      value: `${s.goalsCompleted}`,     inline: true },
        { name: "✅ Check-In Rate",   value: `${s.checkinConsistency}%`,inline: true },
        { name: "🔢 Total Trades",    value: `${s.totalTrades}`,        inline: true }
      )
      .setFooter({ text: `${range.start} → ${range.end}` })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────

  private async leaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();
    const range    = currentWeekRange();
    const allStats = await this.service.leaderboard(range);
    const embed    = new EmbedBuilder()
      .setColor(C.stats).setTitle("🏆 Weekly Leaderboard")
      .setFooter({ text: `${range.start} → ${range.end}` }).setTimestamp();

    if (allStats.length === 0) {
      embed.setDescription("No active traders this week. Be first to log a trade! 📈");
    } else {
      embed.addFields(allStats.slice(0, 10).map((s, i) => ({
        name:   `${MEDALS[i] ?? `**${i + 1}.**`} <@${s.discordUserId}> — Score: ${Math.round(traderScore(s))}`,
        value:  `Discipline ${s.disciplineScore}% · Win ${s.winRate}% · Net ${s.netPerformanceR}R · Check-ins ${s.checkinConsistency}%`,
        inline: false
      })));
    }
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Streak 🔥 ─────────────────────────────────────────────────────────────

  private async streak(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();

    const data = await this.service.getStreaks(interaction.user.id);
    const bestMax = Math.max(data.checkinBest, data.disciplineBest, 1);

    const embed = new EmbedBuilder()
      .setColor(C.streak)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("🔥 Streak Report")
      .addFields(
        {
          name:   "📅 Check-In Streak",
          value:  `${progressBar(data.checkinCurrent, Math.max(bestMax, 7))} **${data.checkinCurrent}** days active\nBest: **${data.checkinBest}** days`,
          inline: false
        },
        {
          name:   "📋 Discipline Streak",
          value:  `${progressBar(data.disciplineCurrent, Math.max(bestMax, 7))} **${data.disciplineCurrent}** days active\nBest: **${data.disciplineBest}** days`,
          inline: false
        }
      )
      .setFooter({
        text: data.checkinCurrent === 0 && data.disciplineCurrent === 0
          ? "Start today to build your streak! 💪"
          : "Keep it going — don't break the chain!"
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── History ───────────────────────────────────────────────────────────────

  private async history(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const days   = interaction.options.getInteger("days") ?? 7;
    const trades = await this.service.recentTrades(interaction.user.id, days);

    if (trades.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(C.info)
        .setTitle(`📜 Trade History — Last ${days} days`)
        .setDescription("No trades logged in this period. Hit the markets! 📈");
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const resultEmoji = { Win: "✅", Loss: "❌", BE: "➖", Open: "🔄" };
    const lines = trades.map(t => {
      const emoji = resultEmoji[t.result] ?? "📊";
      const perf  = t.result === "Win" ? `+${t.rr}R` : t.result === "Loss" ? "-1R" : "0R";
      return `${emoji} **${t.pair}** ${t.direction} · 1:${t.rr} · ${perf} · \`${t.date}\``;
    });

    const wins   = trades.filter(t => t.result === "Win").length;
    const losses = trades.filter(t => t.result === "Loss").length;
    const closed = trades.filter(t => t.result !== "Open").length;
    const netR   = trades.reduce((s, t) => s + t.performanceR, 0).toFixed(2);
    const wr     = closed > 0 ? `${Math.round((wins / closed) * 100)}%` : "—";

    const embed = new EmbedBuilder()
      .setColor(Number(netR) >= 0 ? 0x2ECC71 : C.error)
      .setAuthor({ name: `${interaction.user.displayName}'s History`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`📜 Last ${days} Days — ${trades.length} trades`)
      .setDescription(lines.join("\n"))
      .addFields(
        { name: "🏆 Win Rate", value: wr,      inline: true },
        { name: "✅ Wins",     value: `${wins}`,   inline: true },
        { name: "❌ Losses",   value: `${losses}`, inline: true },
        { name: "💰 Net R",    value: `${netR}R`,  inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Learn ─────────────────────────────────────────────────────────────────

  private async learn(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === "start")  return await this.learnStart(interaction);
      if (sub === "stop")   return await this.learnStop(interaction);
      if (sub === "stats")  return await this.learnStats(interaction);
    } catch (error) {
      await this.replyError(interaction, error);
    }
  }

  private async learnStart(interaction: ChatInputCommandInteraction): Promise<void> {
    const topic = interaction.options.getString("topic") ?? undefined;
    await this.service.startLearning(interaction.user.id, interaction.user.username, topic);

    const embed = new EmbedBuilder()
      .setColor(C.learn)
      .setTitle("📚 Study Session Started")
      .setDescription(topic ? `**Topic:** ${topic}` : "Session running — good luck! 💪")
      .setFooter({ text: "Use /learn stop when you're done." })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async learnStop(interaction: ChatInputCommandInteraction): Promise<void> {
    // Defer publicly — stop is a shareable achievement
    await interaction.deferReply();
    const session = await this.service.stopLearning(interaction.user.id);
    const mins    = session.durationMinutes ?? 0;

    const embed = new EmbedBuilder()
      .setColor(C.learn)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("📚 Study Session Complete!")
      .addFields(
        { name: "⏱️ Time Spent",  value: `**${formatDuration(mins)}**`,            inline: true },
        { name: "📖 Topic",        value: session.topic ?? "General studying",       inline: true }
      )
      .setFooter({ text: mins >= 60 ? "Incredible focus! 🔥" : mins >= 30 ? "Great session! 💪" : "Every minute counts ✅" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async learnStats(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const stats   = await this.service.getLearningStats(interaction.user.id);
    const active  = await this.service.findActiveLearning(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(C.learn)
      .setAuthor({ name: interaction.user.displayName, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("📚 Learning Stats");

    if (stats.totalSessions === 0 && !active) {
      embed.setDescription("No study sessions yet. Start one with `/learn start`! 📖");
    } else {
      embed.addFields(
        { name: "📅 This Week",      value: formatDuration(stats.thisWeekMinutes),     inline: true },
        { name: "🕐 All-Time Total", value: formatDuration(stats.totalMinutes),        inline: true },
        { name: "📊 Sessions",       value: `${stats.totalSessions}`,                  inline: true },
        { name: "⏱️ Avg Session",    value: formatDuration(stats.avgSessionMinutes),   inline: true },
        { name: "🏆 Longest",        value: formatDuration(stats.longestSessionMinutes), inline: true }
      );
      if (active) {
        const elapsed = Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60_000);
        embed.addFields({
          name:  "🟢 Active Session",
          value: `Running for **${formatDuration(elapsed)}**${active.topic ? ` — *${active.topic}*` : ""}`,
          inline: false
        });
      }
    }
    embed.setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Help ──────────────────────────────────────────────────────────────────

  private async help(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(C.info)
      .setTitle("📚 Bot Command Guide")
      .setDescription("Everything you can do and where to do it.")
      .addFields(
        { name: "📅 Daily Check-In",      value: `\`/checkin\` → <#${env.CHANNEL_DAILY_CHECK_IN_ID}>\nNumbers first, trading plan in popup.`,                                 inline: false },
        { name: "📈 Trade Journal",        value: `\`/trade\` → <#${env.CHANNEL_TRADE_JOURNAL_ID}>\nPair/direction/result dropdowns → prices in popup.`,                       inline: false },
        { name: "🎯 Goals",               value: `\`/goal\` \`/goal-status\` → <#${env.CHANNEL_WEEKLY_GOALS_ID}>\nCreate goals and update progress (autocomplete on name).`,  inline: false },
        { name: "📋 Discipline Log",       value: `\`/discipline\` → <#${env.CHANNEL_DISCIPLINE_LOG_ID}>\nEnd-of-day review with a confirmation step.`,                        inline: false },
        { name: "📊 Progress",            value: `\`/stats\` Quick snapshot\n\`/my-week\` Full weekly\n\`/my-month\` Full monthly\n\`/leaderboard\` Group ranking\n\`/streak\` Your streaks 🔥\n\`/history\` Recent trades\n→ <#${env.CHANNEL_PROGRESS_TRACKER_ID}>`, inline: false },
        { name: "📚 Learning Tracker",    value: `\`/learn start [topic]\` — Start a study session\n\`/learn stop\` — Log your time\n\`/learn stats\` — View your totals\nWorks from any channel.`, inline: false }
      )
      .setFooter({ text: "Tip: /learn stop posts publicly — great for group accountability!" });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ── Button handler ────────────────────────────────────────────────────────

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    try {
      if (interaction.customId === "checkin_plan_btn")  return await this.checkinPlanButton(interaction);
      if (interaction.customId === "disc_confirm")      return await this.disciplineConfirm(interaction);
      if (interaction.customId === "disc_cancel")       return await this.disciplineCancel(interaction);
    } catch (error) {
      await this.replyError(interaction, error);
    }
  }

  private async checkinPlanButton(interaction: ButtonInteraction): Promise<void> {
    const pending = this.pendingCheckins.get(interaction.user.id);
    if (!pending || Date.now() > pending.expiresAt) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(C.error).setDescription("❌ Session expired. Please run `/checkin` again.")],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const modal = new ModalBuilder().setCustomId("checkin_plan_modal").setTitle("Today's Trading Plan");
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("trading_plan")
          .setLabel("What is your trading plan for today?")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Key levels, pairs to watch, rules, setups you're targeting...")
          .setMinLength(10).setMaxLength(2000).setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }

  private async disciplineConfirm(interaction: ButtonInteraction): Promise<void> {
    const pending = this.pendingDiscipline.get(interaction.user.id);
    if (!pending || Date.now() > pending.expiresAt) {
      await interaction.update({
        content: "❌ Session expired. Please run `/discipline` again.",
        embeds: [], components: []
      });
      return;
    }
    this.pendingDiscipline.delete(interaction.user.id);

    // Acknowledge and update the ephemeral message
    await interaction.update({ content: "⏳ Saving…", embeds: [], components: [] });

    const record = await this.service.submitDiscipline({
      discordUserId:   interaction.user.id,
      discordUsername: interaction.user.username,
      date:            todayInTimezone(env.TIMEZONE),
      ...pending
    });

    const embedColor = record.score >= 75 ? 0x2ECC71 : record.score >= 50 ? C.discipline : C.error;
    const publicEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: `${interaction.user.displayName}'s Discipline Log`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`📋 Discipline Log — ${record.score}%`)
      .addFields(
        { name: "📌 Followed Plan",    value: pending.followedPlan   ? "✅ Yes (+25)" : "❌ No (0)",   inline: true },
        { name: "🎭 Revenge Traded",   value: pending.revengeTraded  ? "❌ Yes (0)"  : "✅ No (+25)",  inline: true },
        { name: "📈 Overtraded",       value: pending.overtraded     ? "❌ Yes (0)"  : "✅ No (+25)",  inline: true },
        { name: "⚠️ Broke Risk Rules", value: pending.brokeRiskRules ? "❌ Yes (0)"  : "✅ No (+25)",  inline: true }
      )
      .setFooter({ text: "Each rule you keep earns 25 points. Perfect score = 100%." })
      .setTimestamp();

    // Post publicly in the channel
    if (interaction.channel?.isSendable()) {
      await interaction.channel.send({ embeds: [publicEmbed] });
    }
    // Update the ephemeral to show "done" (no buttons)
    await interaction.editReply({ content: "✅ Discipline log saved!", embeds: [], components: [] });
  }

  private async disciplineCancel(interaction: ButtonInteraction): Promise<void> {
    this.pendingDiscipline.delete(interaction.user.id);
    await interaction.update({ content: "❌ Cancelled — no log was saved.", embeds: [], components: [] });
  }

  // ── Modal handler ─────────────────────────────────────────────────────────

  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      if (interaction.customId === "checkin_plan_modal") return await this.checkinModal(interaction);
      if (interaction.customId === "trade_modal")        return await this.tradeModal(interaction);
    } catch (error) {
      await this.replyError(interaction, error);
    }
  }

  // ── Check-In modal submit ─────────────────────────────────────────────────

  private async checkinModal(interaction: ModalSubmitInteraction): Promise<void> {
    const pending = this.pendingCheckins.get(interaction.user.id);
    if (!pending || Date.now() > pending.expiresAt) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(C.error).setDescription("❌ Session expired. Run `/checkin` again.")],
        flags: MessageFlags.Ephemeral
      });
      return;
    }
    const tradingPlan = interaction.fields.getTextInputValue("trading_plan");
    this.pendingCheckins.delete(interaction.user.id);
    await interaction.deferReply();

    await this.service.submitCheckin({
      discordUserId:   interaction.user.id,
      discordUsername: interaction.user.username,
      date:            todayInTimezone(env.TIMEZONE),
      mood:            pending.mood,
      sleepHours:      pending.sleepHours,
      energy:          pending.energy,
      focus:           pending.focus,
      tradingPlan
    });

    const readiness      = Math.round((pending.mood + pending.energy + pending.focus) / 3);
    const readinessLabel = readiness >= 8 ? "🔥 High" : readiness >= 5 ? "✅ Good" : "⚠️ Low";
    const planPreview    = tradingPlan.length > 350 ? tradingPlan.slice(0, 350) + "…" : tradingPlan;

    const embed = new EmbedBuilder()
      .setColor(C.checkin)
      .setAuthor({ name: `${interaction.user.displayName}'s Check-In`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle("✅ Daily Check-In Logged")
      .addFields(
        { name: "😊 Mood",         value: `**${pending.mood}**/10`,       inline: true },
        { name: "😴 Sleep",        value: `**${pending.sleepHours}**h`,   inline: true },
        { name: "⚡ Energy",       value: `**${pending.energy}**/10`,     inline: true },
        { name: "🎯 Focus",        value: `**${pending.focus}**/10`,      inline: true },
        { name: "🧠 Readiness",    value: readinessLabel,                 inline: true },
        { name: "\u200B",          value: "\u200B",                       inline: true },
        { name: "📋 Trading Plan", value: planPreview }
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Trade modal submit ────────────────────────────────────────────────────

  private async tradeModal(interaction: ModalSubmitInteraction): Promise<void> {
    const pending = this.pendingTrades.get(interaction.user.id);
    if (!pending || Date.now() > pending.expiresAt) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(C.error).setDescription("❌ Session expired. Run `/trade` again.")],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const rawEntry   = interaction.fields.getTextInputValue("entry");
    const rawSL      = interaction.fields.getTextInputValue("stop_loss");
    const rawTP      = interaction.fields.getTextInputValue("take_profit");
    const rawRisk    = interaction.fields.getTextInputValue("risk_percent");
    const rawScreen  = interaction.fields.getTextInputValue("screenshot_url").trim();

    const entry      = parseFloat(rawEntry);
    const stopLoss   = parseFloat(rawSL);
    const takeProfit = parseFloat(rawTP);
    const riskPct    = parseFloat(rawRisk);

    if ([entry, stopLoss, takeProfit, riskPct].some(n => isNaN(n))) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(C.error).setDescription("❌ Entry, SL, TP, and Risk % must be numbers.")],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    this.pendingTrades.delete(interaction.user.id);
    await interaction.deferReply();

    const trade = await this.service.submitTrade({
      discordUserId:   interaction.user.id,
      discordUsername: interaction.user.username,
      date:            todayInTimezone(env.TIMEZONE),
      pair:            pending.pair,
      direction:       pending.direction,
      entry, stopLoss, takeProfit,
      riskPercent:     riskPct,
      result:          pending.result,
      screenshotUrl:   rawScreen || undefined
    });

    const resultEmoji = { Win: "✅", Loss: "❌", BE: "➖", Open: "🔄" }[trade.result] ?? "📊";
    const perfLabel   = trade.result === "Win" ? `+${trade.performanceR}R` : trade.result === "Loss" ? `-1R` : `0R`;
    const embedColor  = trade.result === "Win" ? 0x2ECC71 : trade.result === "Loss" ? C.error : C.trade;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: `${interaction.user.displayName}'s Trade`, iconURL: interaction.user.displayAvatarURL() })
      .setTitle(`${resultEmoji} Trade Logged — ${trade.pair} ${trade.direction}`)
      .addFields(
        { name: "📈 Entry",       value: `${trade.entry}`,        inline: true },
        { name: "🛑 Stop Loss",   value: `${trade.stopLoss}`,     inline: true },
        { name: "🎯 Take Profit", value: `${trade.takeProfit}`,   inline: true },
        { name: "📊 RR",          value: `1:${trade.rr}`,         inline: true },
        { name: "💰 Performance", value: perfLabel,               inline: true },
        { name: "⚠️ Risk",        value: `${trade.riskPercent}%`, inline: true }
      )
      .setTimestamp();

    if (trade.screenshotUrl) embed.setImage(trade.screenshotUrl);
    await interaction.editReply({ embeds: [embed] });
  }

  // ── Autocomplete ──────────────────────────────────────────────────────────

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    try {
      const focused = interaction.options.getFocused(true);
      if (interaction.commandName === "goal-status" && focused.name === "goal_id") {
        const goals = await this.service.listActiveGoals(interaction.user.id);
        const query = focused.value.toLowerCase();
        await interaction.respond(
          goals
            .filter(g => g.goalText.toLowerCase().includes(query) || g.goalId.includes(query))
            .slice(0, 25)
            .map(g => ({ name: g.goalText.length > 97 ? g.goalText.slice(0, 97) + "…" : g.goalText, value: g.goalId }))
        );
        return;
      }
      await interaction.respond([]);
    } catch {
      try { await interaction.respond([]); } catch { /* ignore */ }
    }
  }
}
