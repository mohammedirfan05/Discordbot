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
import type { Direction, GoalStatus, TradeResult } from "../domain/types.js";
import type { AccountabilityService } from "../application/accountabilityService.js";
import { traderScore } from "../application/accountabilityService.js";
import { requireChannel } from "./channelGuard.js";

// ── Colour palette ────────────────────────────────────────────────────────────

const C = {
  checkin:    0x5DE8A5, // teal-green
  trade:      0x5865F2, // Discord blurple
  goal:       0x9B59B6, // purple
  discipline: 0xF0C040, // amber
  stats:      0x3498DB, // blue
  error:      0xE74C3C, // red
  info:       0x95A5A6  // grey
} as const;

const MEDALS = ["🥇", "🥈", "🥉"];

// ── In-memory store for two-step check-in ─────────────────────────────────────
// Holds the numeric fields from Step 1 while the user fills the modal in Step 2.

interface PendingCheckin {
  mood:       number;
  sleepHours: number;
  energy:     number;
  focus:      number;
  expiresAt:  number; // unix ms
}

// ── Handler ───────────────────────────────────────────────────────────────────

export class InteractionHandler {
  private readonly pendingCheckins = new Map<string, PendingCheckin>();

  constructor(private readonly service: AccountabilityService) {
    // Purge stale pending check-ins every 5 minutes to avoid memory leaks.
    setInterval(() => {
      const now = Date.now();
      for (const [userId, data] of this.pendingCheckins) {
        if (data.expiresAt < now) this.pendingCheckins.delete(userId);
      }
    }, 5 * 60 * 1000);
  }

  // ── Main router ─────────────────────────────────────────────────────────────

  async handle(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) return this.handleCommand(interaction);
    if (interaction.isAutocomplete())     return this.handleAutocomplete(interaction);
    if (interaction.isButton())           return this.handleButton(interaction);
    if (interaction.isModalSubmit())      return this.handleModal(interaction);
  }

  // ── Slash command dispatch ───────────────────────────────────────────────────

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
        case "help":        return await this.help(interaction);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      const embed = new EmbedBuilder().setColor(C.error).setDescription(`❌ ${message}`);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
      } catch { /* swallow double-reply errors */ }
    }
  }

  // ── Check-In — Step 1: collect numbers, show "Add Trading Plan" button ───────

  private async checkin(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_DAILY_CHECK_IN_ID)) return;

    const mood       = interaction.options.getInteger("mood",        true);
    const sleepHours = interaction.options.getNumber("sleep_hours",  true);
    const energy     = interaction.options.getInteger("energy",      true);
    const focus      = interaction.options.getInteger("focus",       true);

    // Persist numeric fields; Step 2 (modal submit) will complete the check-in.
    this.pendingCheckins.set(interaction.user.id, {
      mood, sleepHours, energy, focus,
      expiresAt: Date.now() + 10 * 60 * 1000  // 10-minute window
    });

    const readiness      = Math.round((mood + energy + focus) / 3);
    const readinessLabel = readiness >= 8 ? "🔥 High" : readiness >= 5 ? "✅ Good" : "⚠️ Low";

    const embed = new EmbedBuilder()
      .setColor(C.checkin)
      .setTitle("📊 Check-In — Step 1 of 2")
      .setDescription("Numbers saved! Click **Add Trading Plan** to finish your check-in.")
      .addFields(
        { name: "😊 Mood",      value: `**${mood}**/10`,       inline: true },
        { name: "😴 Sleep",     value: `**${sleepHours}**h`,   inline: true },
        { name: "⚡ Energy",    value: `**${energy}**/10`,     inline: true },
        { name: "🎯 Focus",     value: `**${focus}**/10`,      inline: true },
        { name: "🧠 Readiness", value: readinessLabel,         inline: true }
      )
      .setFooter({ text: "Expires in 10 minutes." });

    const button = new ButtonBuilder()
      .setCustomId("checkin_plan_btn")
      .setLabel("📝 Add Trading Plan")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }

  // ── Button — open the trading plan modal ─────────────────────────────────────

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    try {
      if (interaction.customId !== "checkin_plan_btn") return;

      const pending = this.pendingCheckins.get(interaction.user.id);
      if (!pending || Date.now() > pending.expiresAt) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(C.error)
            .setDescription("❌ Session expired. Please run `/checkin` again.")],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("checkin_plan_modal")
        .setTitle("Today's Trading Plan");

      const planInput = new TextInputBuilder()
        .setCustomId("trading_plan")
        .setLabel("What is your trading plan for today?")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Key levels, pairs to watch, rules for today, setups you're targeting...")
        .setMinLength(10)
        .setMaxLength(2000)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(planInput));
      await interaction.showModal(modal);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [new EmbedBuilder().setColor(C.error).setDescription(`❌ ${message}`)],
            flags: MessageFlags.Ephemeral
          });
        }
      } catch { /* swallow */ }
    }
  }

  // ── Modal — submit the complete check-in ─────────────────────────────────────

  private async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      if (interaction.customId !== "checkin_plan_modal") return;

      const pending = this.pendingCheckins.get(interaction.user.id);
      if (!pending || Date.now() > pending.expiresAt) {
        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(C.error)
            .setDescription("❌ Session expired. Please run `/checkin` again.")],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const tradingPlan = interaction.fields.getTextInputValue("trading_plan");
      this.pendingCheckins.delete(interaction.user.id);

      // Defer publicly — the confirmation embed will appear in #daily-check-in
      // so the whole group can see who checked in.
      await interaction.deferReply();

      await this.service.submitCheckin({
        discordUserId:  interaction.user.id,
        discordUsername: interaction.user.username,
        date:           todayInTimezone(env.TIMEZONE),
        mood:           pending.mood,
        sleepHours:     pending.sleepHours,
        energy:         pending.energy,
        focus:          pending.focus,
        tradingPlan
      });

      const readiness      = Math.round((pending.mood + pending.energy + pending.focus) / 3);
      const readinessLabel = readiness >= 8 ? "🔥 High" : readiness >= 5 ? "✅ Good" : "⚠️ Low";
      const planPreview    = tradingPlan.length > 350
        ? tradingPlan.slice(0, 350) + "…"
        : tradingPlan;

      const embed = new EmbedBuilder()
        .setColor(C.checkin)
        .setAuthor({
          name:    `${interaction.user.displayName}'s Check-In`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTitle("✅ Daily Check-In Logged")
        .addFields(
          { name: "😊 Mood",      value: `**${pending.mood}**/10`,       inline: true },
          { name: "😴 Sleep",     value: `**${pending.sleepHours}**h`,   inline: true },
          { name: "⚡ Energy",    value: `**${pending.energy}**/10`,     inline: true },
          { name: "🎯 Focus",     value: `**${pending.focus}**/10`,      inline: true },
          { name: "🧠 Readiness", value: readinessLabel,                 inline: true },
          { name: "\u200B",       value: "\u200B",                       inline: true },
          { name: "📋 Trading Plan", value: planPreview }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save check-in.";
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(C.error).setDescription(`❌ ${message}`)]
          });
        } else {
          await interaction.reply({
            embeds: [new EmbedBuilder().setColor(C.error).setDescription(`❌ ${message}`)],
            flags: MessageFlags.Ephemeral
          });
        }
      } catch { /* swallow */ }
    }
  }

  // ── Trade ─────────────────────────────────────────────────────────────────────

  private async trade(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_TRADE_JOURNAL_ID)) return;
    await interaction.deferReply();

    const trade = await this.service.submitTrade({
      discordUserId:  interaction.user.id,
      discordUsername: interaction.user.username,
      date:           todayInTimezone(env.TIMEZONE),
      pair:           interaction.options.getString("pair",       true),
      direction:      interaction.options.getString("direction",  true) as Direction,
      entry:          interaction.options.getNumber("entry",      true),
      stopLoss:       interaction.options.getNumber("stop_loss",  true),
      takeProfit:     interaction.options.getNumber("take_profit", true),
      riskPercent:    interaction.options.getNumber("risk_percent", true),
      result:         interaction.options.getString("result",     true) as TradeResult,
      screenshotUrl:  interaction.options.getString("screenshot_url") ?? undefined
    });

    const resultEmoji = { Win: "✅", Loss: "❌", BE: "➖", Open: "🔄" }[trade.result] ?? "📊";
    const perfLabel   = trade.performanceR >= 0 ? `+${trade.performanceR}R` : `${trade.performanceR}R`;
    const embedColor  = trade.result === "Win"  ? 0x2ECC71
                      : trade.result === "Loss" ? C.error
                      : C.trade;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name:    `${interaction.user.displayName}'s Trade`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle(`${resultEmoji} Trade Logged — ${trade.pair} ${trade.direction}`)
      .addFields(
        { name: "📈 Entry",        value: `${trade.entry}`,        inline: true },
        { name: "🛑 Stop Loss",    value: `${trade.stopLoss}`,     inline: true },
        { name: "🎯 Take Profit",  value: `${trade.takeProfit}`,   inline: true },
        { name: "📊 RR",           value: `1:${trade.rr}`,         inline: true },
        { name: "💰 Performance",  value: perfLabel,               inline: true },
        { name: "⚠️ Risk",         value: `${trade.riskPercent}%`, inline: true }
      )
      .setTimestamp();

    if (trade.screenshotUrl) embed.setImage(trade.screenshotUrl);

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Goal ──────────────────────────────────────────────────────────────────────

  private async goal(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_WEEKLY_GOALS_ID)) return;
    await interaction.deferReply();

    const goalText = interaction.options.getString("goal",     true);
    const category = interaction.options.getString("category", true);
    const deadline = interaction.options.getString("deadline", true);

    const goalId = await this.service.createGoal({
      discordUserId:   interaction.user.id,
      discordUsername: interaction.user.username,
      goal:            goalText,
      category,
      deadline
    });

    const embed = new EmbedBuilder()
      .setColor(C.goal)
      .setAuthor({
        name:    `${interaction.user.displayName}'s Goal`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle("🎯 Goal Created")
      .addFields(
        { name: "📌 Goal",      value: goalText,           inline: false },
        { name: "🏷️ Category", value: category,           inline: true  },
        { name: "📅 Deadline",  value: deadline,           inline: true  },
        { name: "🆔 Goal ID",   value: `\`${goalId}\``,   inline: false }
      )
      .setFooter({ text: "Use /goal-status to track progress — autocomplete will find this goal." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Goal Status ───────────────────────────────────────────────────────────────

  private async goalStatus(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_WEEKLY_GOALS_ID)) return;
    await interaction.deferReply();

    const goalId    = interaction.options.getString("goal_id", true);
    const newStatus = interaction.options.getString("status",  true) as GoalStatus;

    await this.service.updateGoalStatus(interaction.user.id, goalId, newStatus);

    const statusEmoji: Record<GoalStatus, string> = {
      "Not Started": "⏳",
      "In Progress": "🔄",
      "Completed":   "✅",
      "Blocked":     "⛔"
    };
    const embedColor = newStatus === "Completed" ? 0x2ECC71
                     : newStatus === "Blocked"   ? C.error
                     : C.goal;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`${statusEmoji[newStatus]} Goal Updated`)
      .setDescription(`Status changed to **${newStatus}**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Discipline ────────────────────────────────────────────────────────────────

  private async discipline(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_DISCIPLINE_LOG_ID)) return;
    await interaction.deferReply();

    const followedPlan   = interaction.options.getBoolean("followed_plan",    true);
    const revengeTraded  = interaction.options.getBoolean("revenge_traded",   true);
    const overtraded     = interaction.options.getBoolean("overtraded",       true);
    const brokeRiskRules = interaction.options.getBoolean("broke_risk_rules", true);

    const record = await this.service.submitDiscipline({
      discordUserId:   interaction.user.id,
      discordUsername: interaction.user.username,
      date:            todayInTimezone(env.TIMEZONE),
      followedPlan,
      revengeTraded,
      overtraded,
      brokeRiskRules
    });

    const embedColor = record.score >= 75 ? 0x2ECC71
                     : record.score >= 50 ? C.discipline
                     : C.error;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({
        name:    `${interaction.user.displayName}'s Discipline Log`,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle(`📋 Discipline Log — ${record.score}%`)
      .addFields(
        { name: "📌 Followed Plan",     value: followedPlan   ? "✅ Yes (+25)" : "❌ No (0)",  inline: true },
        { name: "🎭 Revenge Traded",    value: revengeTraded  ? "❌ Yes (0)"  : "✅ No (+25)", inline: true },
        { name: "📈 Overtraded",        value: overtraded     ? "❌ Yes (0)"  : "✅ No (+25)", inline: true },
        { name: "⚠️ Broke Risk Rules",  value: brokeRiskRules ? "❌ Yes (0)"  : "✅ No (+25)", inline: true }
      )
      .setFooter({ text: "Each rule you keep earns 25 points. Perfect score = 100%." })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Stats — quick 3-metric snapshot ──────────────────────────────────────────

  private async statsSnapshot(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();

    const range = currentWeekRange();
    const s     = await this.service.statsForUser(interaction.user.id, range);

    const embed = new EmbedBuilder()
      .setColor(C.stats)
      .setAuthor({
        name:    interaction.user.displayName,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle("⚡ Quick Stats — This Week")
      .addFields(
        { name: "📋 Discipline", value: `**${s.disciplineScore}%**`,  inline: true },
        { name: "🏆 Win Rate",   value: `**${s.winRate}%**`,          inline: true },
        { name: "💰 Net P&L",    value: `**${s.netPerformanceR}R**`,  inline: true }
      )
      .setFooter({ text: `${range.start} → ${range.end} · /my-week for the full breakdown` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Stats — full period breakdown ─────────────────────────────────────────────

  private async statsFullPeriod(
    interaction: ChatInputCommandInteraction,
    period: "week" | "month"
  ): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();

    const range = period === "week" ? currentWeekRange() : currentMonthRange();
    const s     = await this.service.statsForUser(interaction.user.id, range);

    const embed = new EmbedBuilder()
      .setColor(C.stats)
      .setAuthor({
        name:    interaction.user.displayName,
        iconURL: interaction.user.displayAvatarURL()
      })
      .setTitle(`📊 ${period === "week" ? "Weekly" : "Monthly"} Report`)
      .addFields(
        { name: "📋 Discipline",       value: `${s.disciplineScore}%`,    inline: true },
        { name: "🏆 Win Rate",         value: `${s.winRate}%`,            inline: true },
        { name: "📈 Avg RR",           value: `1:${s.averageRr}`,         inline: true },
        { name: "💰 Net Performance",  value: `${s.netPerformanceR}R`,    inline: true },
        { name: "🎯 Goals Completed",  value: `${s.goalsCompleted}`,      inline: true },
        { name: "✅ Check-In Rate",    value: `${s.checkinConsistency}%`, inline: true },
        { name: "🔢 Total Trades",     value: `${s.totalTrades}`,         inline: true }
      )
      .setFooter({ text: `${range.start} → ${range.end}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────────

  private async leaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!await requireChannel(interaction, env.CHANNEL_PROGRESS_TRACKER_ID)) return;
    await interaction.deferReply();

    const range    = currentWeekRange();
    const allStats = await this.service.leaderboard(range);

    const embed = new EmbedBuilder()
      .setColor(C.stats)
      .setTitle("🏆 Weekly Leaderboard")
      .setFooter({ text: `${range.start} → ${range.end}` })
      .setTimestamp();

    if (allStats.length === 0) {
      embed.setDescription("No active traders found this week. Be the first to log a trade! 📈");
    } else {
      const fields = allStats.slice(0, 10).map((s, i) => ({
        name:   `${MEDALS[i] ?? `**${i + 1}.**`} <@${s.discordUserId}> — Score: ${Math.round(traderScore(s))}`,
        value:  `Discipline ${s.disciplineScore}% · Win ${s.winRate}% · Net ${s.netPerformanceR}R · Check-ins ${s.checkinConsistency}%`,
        inline: false
      }));
      embed.addFields(...fields);
    }

    await interaction.editReply({ embeds: [embed] });
  }

  // ── Help — works from any channel ────────────────────────────────────────────

  private async help(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(C.info)
      .setTitle("📚 Bot Command Guide")
      .setDescription("Everything you can do and where to do it.")
      .addFields(
        {
          name:   "📅 Daily Check-In",
          value:  `\`/checkin\` → <#${env.CHANNEL_DAILY_CHECK_IN_ID}>\nFill in your numbers, then add your plan in the popup.`,
          inline: false
        },
        {
          name:   "📈 Trade Journal",
          value:  `\`/trade\` → <#${env.CHANNEL_TRADE_JOURNAL_ID}>\nLog a trade — entry, SL, TP, risk, and result.`,
          inline: false
        },
        {
          name:   "🎯 Goals",
          value:  `\`/goal\` — Create a goal → <#${env.CHANNEL_WEEKLY_GOALS_ID}>\n\`/goal-status\` — Update progress (autocomplete works!)`,
          inline: false
        },
        {
          name:   "📋 Discipline Log",
          value:  `\`/discipline\` → <#${env.CHANNEL_DISCIPLINE_LOG_ID}>\nEnd-of-day review: did you stick to your rules?`,
          inline: false
        },
        {
          name:   "📊 Progress & Leaderboard",
          value:  `\`/stats\` Quick 3-metric snapshot\n\`/my-week\` Full weekly breakdown\n\`/my-month\` Full monthly breakdown\n\`/leaderboard\` Weekly group ranking\n→ All in <#${env.CHANNEL_PROGRESS_TRACKER_ID}>`,
          inline: false
        }
      )
      .setFooter({ text: "Tip: /checkin is a two-step flow — numbers first, then trading plan in a popup." });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // ── Autocomplete — goal_id lookup for /goal-status ───────────────────────────

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    try {
      const focused = interaction.options.getFocused(true);

      if (interaction.commandName === "goal-status" && focused.name === "goal_id") {
        const goals = await this.service.listActiveGoals(interaction.user.id);
        const query = focused.value.toLowerCase();

        const matches = goals
          .filter(g => g.goalText.toLowerCase().includes(query) || g.goalId.includes(query))
          .slice(0, 25); // Discord max 25 autocomplete choices

        await interaction.respond(
          matches.map(g => ({
            name:  g.goalText.length > 97 ? g.goalText.slice(0, 97) + "…" : g.goalText,
            value: g.goalId
          }))
        );
        return;
      }

      await interaction.respond([]);
    } catch {
      try { await interaction.respond([]); } catch { /* ignore */ }
    }
  }
}
