import { SlashCommandBuilder } from "discord.js";

const GOAL_CATEGORIES = [
  { name: "Execution",        value: "Execution" },
  { name: "Risk Management",  value: "Risk Management" },
  { name: "Psychology",       value: "Psychology" },
  { name: "Analysis",         value: "Analysis" },
  { name: "Journaling",       value: "Journaling" },
  { name: "Other",            value: "Other" }
];

const PAIRS = [
  { name: "Micro Nasdaq (MNQ)",          value: "MNQ" },
  { name: "Micro E-mini S&P 500 (ES)",   value: "ES" }
];

export const commandDefinitions = [
  // ── Daily Check-In (Step 1 of 2 — trading plan collected via modal) ───────
  new SlashCommandBuilder()
    .setName("checkin")
    .setDescription("Start your daily check-in. You'll add your trading plan in a popup next.")
    .addIntegerOption(o =>
      o.setName("mood").setDescription("Mood from 1 (low) to 10 (great)")
       .setMinValue(1).setMaxValue(10).setRequired(true))
    .addNumberOption(o =>
      o.setName("sleep_hours").setDescription("Hours of sleep last night")
       .setMinValue(0).setMaxValue(24).setRequired(true))
    .addIntegerOption(o =>
      o.setName("energy").setDescription("Energy level from 1 (drained) to 10 (energised)")
       .setMinValue(1).setMaxValue(10).setRequired(true))
    .addIntegerOption(o =>
      o.setName("focus").setDescription("Focus level from 1 (scattered) to 10 (locked in)")
       .setMinValue(1).setMaxValue(10).setRequired(true)),

  // ── Trade Journal ─────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Log a trade to your journal.")
    .addStringOption(o =>
      o.setName("pair").setDescription("Trading instrument")
       .setRequired(true).addChoices(...PAIRS))
    .addStringOption(o =>
      o.setName("direction").setDescription("Trade direction")
       .setRequired(true).addChoices({ name: "Long", value: "Long" }, { name: "Short", value: "Short" }))
    .addNumberOption(o =>
      o.setName("entry").setDescription("Entry price").setRequired(true))
    .addNumberOption(o =>
      o.setName("stop_loss").setDescription("Stop loss price").setRequired(true))
    .addNumberOption(o =>
      o.setName("take_profit").setDescription("Take profit price").setRequired(true))
    .addNumberOption(o =>
      o.setName("risk_percent").setDescription("Risk % of account (e.g. 1 = 1%)")
       .setMinValue(0.01).setMaxValue(10).setRequired(true))
    .addStringOption(o =>
      o.setName("result").setDescription("Trade result")
       .setRequired(true).addChoices(
         { name: "Win",         value: "Win" },
         { name: "Loss",        value: "Loss" },
         { name: "Break Even",  value: "BE" },
         { name: "Open",        value: "Open" }
       ))
    .addStringOption(o =>
      o.setName("screenshot_url").setDescription("Chart screenshot URL (optional)").setRequired(false)),

  // ── Goals ─────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("goal")
    .setDescription("Create a new weekly goal.")
    .addStringOption(o =>
      o.setName("goal").setDescription("Describe your goal").setRequired(true))
    .addStringOption(o =>
      o.setName("category").setDescription("Goal category")
       .setRequired(true).addChoices(...GOAL_CATEGORIES))
    .addStringOption(o =>
      o.setName("deadline").setDescription("Deadline date (YYYY-MM-DD)").setRequired(true)),

  // ── Goal Status — goal_id uses autocomplete to list the user's active goals
  new SlashCommandBuilder()
    .setName("goal-status")
    .setDescription("Update the status of one of your goals.")
    .addStringOption(o =>
      o.setName("goal_id").setDescription("Start typing to search your active goals")
       .setRequired(true).setAutocomplete(true))
    .addStringOption(o =>
      o.setName("status").setDescription("New status")
       .setRequired(true).addChoices(
         { name: "Not Started",    value: "Not Started" },
         { name: "In Progress",    value: "In Progress" },
         { name: "Completed ✅",   value: "Completed" },
         { name: "Blocked ⛔",     value: "Blocked" }
       )),

  // ── Discipline Log ────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("discipline")
    .setDescription("Submit your end-of-day discipline log.")
    .addBooleanOption(o =>
      o.setName("followed_plan").setDescription("Did you follow your trading plan?").setRequired(true))
    .addBooleanOption(o =>
      o.setName("revenge_traded").setDescription("Did you revenge trade?").setRequired(true))
    .addBooleanOption(o =>
      o.setName("overtraded").setDescription("Did you overtrade?").setRequired(true))
    .addBooleanOption(o =>
      o.setName("broke_risk_rules").setDescription("Did you break your risk rules?").setRequired(true)),

  // ── Stats ─────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Quick 3-metric snapshot of your week — discipline, win rate, net P&L."),

  new SlashCommandBuilder()
    .setName("my-week")
    .setDescription("Full breakdown of every metric this week."),

  new SlashCommandBuilder()
    .setName("my-month")
    .setDescription("Full breakdown of every metric this month."),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See the weekly performance ranking for the whole group."),

  // ── Help ──────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands and where to use them.")

].map(c => c.toJSON());
