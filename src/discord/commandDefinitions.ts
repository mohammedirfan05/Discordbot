import { SlashCommandBuilder } from "discord.js";

const GOAL_CATEGORIES = [
  { name: "Execution",       value: "Execution" },
  { name: "Risk Management", value: "Risk Management" },
  { name: "Psychology",      value: "Psychology" },
  { name: "Analysis",        value: "Analysis" },
  { name: "Journaling",      value: "Journaling" },
  { name: "Other",           value: "Other" }
];

const PAIRS = [
  { name: "Micro Nasdaq (MNQ)",        value: "MNQ" },
  { name: "Micro E-mini S&P 500 (ES)", value: "ES"  }
];

export const commandDefinitions = [

  // ── Daily Check-In (Step 1 → button → modal) ──────────────────────────────
  new SlashCommandBuilder()
    .setName("checkin")
    .setDescription("Start your daily check-in. You'll add your trading plan in a popup next.")
    .addIntegerOption(o =>
      o.setName("mood").setDescription("Mood 1 (low) → 10 (great)")
       .setMinValue(1).setMaxValue(10).setRequired(true))
    .addNumberOption(o =>
      o.setName("sleep_hours").setDescription("Hours of sleep last night")
       .setMinValue(0).setMaxValue(24).setRequired(true))
    .addIntegerOption(o =>
      o.setName("energy").setDescription("Energy 1 (drained) → 10 (energised)")
       .setMinValue(1).setMaxValue(10).setRequired(true))
    .addIntegerOption(o =>
      o.setName("focus").setDescription("Focus 1 (scattered) → 10 (locked in)")
       .setMinValue(1).setMaxValue(10).setRequired(true)),

  // ── Trade Journal (Step 1: dropdowns → modal for prices) ──────────────────
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Log a trade. Pick the basics below — a popup collects the prices.")
    .addStringOption(o =>
      o.setName("pair").setDescription("Instrument").setRequired(true).addChoices(...PAIRS))
    .addStringOption(o =>
      o.setName("direction").setDescription("Trade direction").setRequired(true)
       .addChoices({ name: "Long", value: "Long" }, { name: "Short", value: "Short" }))
    .addStringOption(o =>
      o.setName("result").setDescription("Trade result").setRequired(true).addChoices(
        { name: "Win",        value: "Win"  },
        { name: "Loss",       value: "Loss" },
        { name: "Break Even", value: "BE"   },
        { name: "Open",       value: "Open" }
      )),

  // ── Goals ──────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("goal")
    .setDescription("Create a new weekly goal.")
    .addStringOption(o =>
      o.setName("goal").setDescription("Describe your goal").setRequired(true))
    .addStringOption(o =>
      o.setName("category").setDescription("Goal category").setRequired(true)
       .addChoices(...GOAL_CATEGORIES))
    .addStringOption(o =>
      o.setName("deadline").setDescription("Deadline (YYYY-MM-DD)").setRequired(true)),

  new SlashCommandBuilder()
    .setName("goal-status")
    .setDescription("Update the status of one of your goals.")
    .addStringOption(o =>
      o.setName("goal_id").setDescription("Start typing to search your active goals")
       .setRequired(true).setAutocomplete(true))
    .addStringOption(o =>
      o.setName("status").setDescription("New status").setRequired(true).addChoices(
        { name: "Not Started",  value: "Not Started" },
        { name: "In Progress",  value: "In Progress"  },
        { name: "Completed ✅", value: "Completed"    },
        { name: "Blocked ⛔",   value: "Blocked"      }
      )),

  // ── Discipline (with confirmation step) ────────────────────────────────────
  new SlashCommandBuilder()
    .setName("discipline")
    .setDescription("Submit your end-of-day discipline log. You'll confirm before it saves.")
    .addBooleanOption(o =>
      o.setName("followed_plan").setDescription("Did you follow your trading plan?").setRequired(true))
    .addBooleanOption(o =>
      o.setName("revenge_traded").setDescription("Did you revenge trade?").setRequired(true))
    .addBooleanOption(o =>
      o.setName("overtraded").setDescription("Did you overtrade?").setRequired(true))
    .addBooleanOption(o =>
      o.setName("broke_risk_rules").setDescription("Did you break your risk rules?").setRequired(true)),

  // ── Stats ──────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Quick 3-metric snapshot of your week."),

  new SlashCommandBuilder()
    .setName("my-week")
    .setDescription("Full breakdown of every metric this week."),

  new SlashCommandBuilder()
    .setName("my-month")
    .setDescription("Full breakdown of every metric this month."),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Weekly performance ranking for the whole group."),

  // ── NEW: Streak ────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("streak")
    .setDescription("See your current check-in and discipline streaks. 🔥"),

  // ── NEW: History ───────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("history")
    .setDescription("View your recent trades.")
    .addIntegerOption(o =>
      o.setName("days").setDescription("How many days back? (1–30, default 7)")
       .setMinValue(1).setMaxValue(30).setRequired(false)),

  // ── NEW: Learn ─────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("learn")
    .setDescription("Track your trading study sessions.")
    .addSubcommand(sub =>
      sub.setName("start").setDescription("Start a study session.")
         .addStringOption(o =>
           o.setName("topic").setDescription("What are you studying? (e.g. Wyckoff, ICT, SMC)")
            .setRequired(false)))
    .addSubcommand(sub =>
      sub.setName("stop").setDescription("Stop your active study session and log the time."))
    .addSubcommand(sub =>
      sub.setName("stats").setDescription("View your total study time and session history.")),

  // ── Help ───────────────────────────────────────────────────────────────────
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all commands and where to use them.")

].map(c => c.toJSON());
