import { SlashCommandBuilder } from "discord.js";

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName("checkin")
    .setDescription("Submit today's trading check-in.")
    .addIntegerOption((option) => option.setName("mood").setDescription("Mood from 1 to 10").setMinValue(1).setMaxValue(10).setRequired(true))
    .addNumberOption((option) => option.setName("sleep_hours").setDescription("Sleep hours").setMinValue(0).setMaxValue(24).setRequired(true))
    .addIntegerOption((option) => option.setName("energy").setDescription("Energy from 1 to 10").setMinValue(1).setMaxValue(10).setRequired(true))
    .addIntegerOption((option) => option.setName("focus").setDescription("Focus from 1 to 10").setMinValue(1).setMaxValue(10).setRequired(true))
    .addStringOption((option) => option.setName("trading_plan").setDescription("Trading plan for today").setRequired(true)),

  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Submit a trade journal entry.")
    .addStringOption((option) => option.setName("pair").setDescription("Trading pair").setRequired(true))
    .addStringOption((option) => option.setName("direction").setDescription("Trade direction").setRequired(true).addChoices({ name: "Long", value: "Long" }, { name: "Short", value: "Short" }))
    .addNumberOption((option) => option.setName("entry").setDescription("Entry price").setRequired(true))
    .addNumberOption((option) => option.setName("stop_loss").setDescription("Stop loss").setRequired(true))
    .addNumberOption((option) => option.setName("take_profit").setDescription("Take profit").setRequired(true))
    .addNumberOption((option) => option.setName("risk_percent").setDescription("Risk percent").setMinValue(0.01).setRequired(true))
    .addStringOption((option) => option.setName("result").setDescription("Trade result").setRequired(true).addChoices(
      { name: "Win", value: "Win" },
      { name: "Loss", value: "Loss" },
      { name: "Break Even", value: "BE" },
      { name: "Open", value: "Open" }
    ))
    .addStringOption((option) => option.setName("screenshot_url").setDescription("Screenshot URL").setRequired(false)),

  new SlashCommandBuilder()
    .setName("goal")
    .setDescription("Create a weekly goal.")
    .addStringOption((option) => option.setName("goal").setDescription("Goal text").setRequired(true))
    .addStringOption((option) => option.setName("category").setDescription("Goal category").setRequired(true))
    .addStringOption((option) => option.setName("deadline").setDescription("Deadline as YYYY-MM-DD").setRequired(true)),

  new SlashCommandBuilder()
    .setName("goal-status")
    .setDescription("Update a goal status.")
    .addStringOption((option) => option.setName("goal_id").setDescription("Goal ID returned by /goal").setRequired(true))
    .addStringOption((option) => option.setName("status").setDescription("New status").setRequired(true).addChoices(
      { name: "Not Started", value: "Not Started" },
      { name: "In Progress", value: "In Progress" },
      { name: "Completed", value: "Completed" },
      { name: "Blocked", value: "Blocked" }
    )),

  new SlashCommandBuilder()
    .setName("discipline")
    .setDescription("Submit today's discipline log.")
    .addBooleanOption((option) => option.setName("followed_plan").setDescription("Did you follow the plan?").setRequired(true))
    .addBooleanOption((option) => option.setName("revenge_traded").setDescription("Did you revenge trade?").setRequired(true))
    .addBooleanOption((option) => option.setName("overtraded").setDescription("Did you overtrade?").setRequired(true))
    .addBooleanOption((option) => option.setName("broke_risk_rules").setDescription("Did you break risk rules?").setRequired(true)),

  new SlashCommandBuilder().setName("stats").setDescription("Show your current week stats."),
  new SlashCommandBuilder().setName("my-week").setDescription("Show your week report."),
  new SlashCommandBuilder().setName("my-month").setDescription("Show your month report."),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Show current week leaderboard.")
].map((command) => command.toJSON());

