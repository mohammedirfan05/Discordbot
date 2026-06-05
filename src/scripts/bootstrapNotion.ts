import "dotenv/config";
import { Client } from "@notionhq/client";
import { z } from "zod";

const env = z.object({
  NOTION_TOKEN: z.string().min(1),
  NOTION_PARENT_PAGE_ID: z.string().min(1)
}).parse(process.env);

const notion = new Client({ auth: env.NOTION_TOKEN });

const users = await createDatabase("Users", {
  Name: { title: {} },
  "Discord User ID": { rich_text: {} },
  "Discord Username": { rich_text: {} },
  Active: { checkbox: {} },
  "Joined At": { date: {} }
});

const checkins = await createDatabase("Daily Checkins", {
  "Checkin ID": { title: {} },
  User: { relation: { database_id: users.id, type: "single_property", single_property: {} } },
  "Discord User ID": { rich_text: {} },
  Date: { date: {} },
  Mood: { number: { format: "number" } },
  "Sleep Hours": { number: { format: "number" } },
  Energy: { number: { format: "number" } },
  Focus: { number: { format: "number" } },
  "Trading Plan": { rich_text: {} }
});

const trades = await createDatabase("Trade Journal", {
  "Trade ID": { title: {} },
  User: { relation: { database_id: users.id, type: "single_property", single_property: {} } },
  "Discord User ID": { rich_text: {} },
  Date: { date: {} },
  Pair: { select: {} },
  Direction: { select: { options: [{ name: "Long", color: "green" }, { name: "Short", color: "red" }] } },
  Entry: { number: { format: "number" } },
  "Stop Loss": { number: { format: "number" } },
  "Take Profit": { number: { format: "number" } },
  "Risk %": { number: { format: "percent" } },
  Result: { select: { options: [{ name: "Win", color: "green" }, { name: "Loss", color: "red" }, { name: "BE", color: "yellow" }, { name: "Open", color: "blue" }] } },
  "Screenshot URL": { url: {} },
  RR: { formula: { expression: "abs(toNumber(prop(\"Take Profit\")) - toNumber(prop(\"Entry\"))) / abs(toNumber(prop(\"Entry\")) - toNumber(prop(\"Stop Loss\")))" } },
  "Performance R": { formula: { expression: "if(prop(\"Result\") == \"Win\", abs(toNumber(prop(\"Take Profit\")) - toNumber(prop(\"Entry\"))) / abs(toNumber(prop(\"Entry\")) - toNumber(prop(\"Stop Loss\"))), if(prop(\"Result\") == \"Loss\", -1, 0))" } }
});

const goals = await createDatabase("Goals", {
  Goal: { title: {} },
  "Goal ID": { rich_text: {} },
  User: { relation: { database_id: users.id, type: "single_property", single_property: {} } },
  "Discord User ID": { rich_text: {} },
  Category: { select: {} },
  Deadline: { date: {} },
  Status: { status: { options: [
    { name: "Not Started", color: "gray" },
    { name: "In Progress", color: "blue" },
    { name: "Completed", color: "green" },
    { name: "Blocked", color: "red" }
  ] } },
  "Created At": { date: {} },
  "Completed At": { date: {} }
});

const discipline = await createDatabase("Discipline Logs", {
  "Discipline ID": { title: {} },
  User: { relation: { database_id: users.id, type: "single_property", single_property: {} } },
  "Discord User ID": { rich_text: {} },
  Date: { date: {} },
  "Followed Plan": { checkbox: {} },
  "Revenge Traded": { checkbox: {} },
  Overtraded: { checkbox: {} },
  "Broke Risk Rules": { checkbox: {} },
  Score: { formula: { expression: "toNumber(prop(\"Followed Plan\")) * 25 + if(prop(\"Revenge Traded\"), 0, 25) + if(prop(\"Overtraded\"), 0, 25) + if(prop(\"Broke Risk Rules\"), 0, 25)" } }
});

const reports = await createDatabase("Reports", {
  "Report ID": { title: {} },
  Type: { select: { options: [{ name: "Daily", color: "blue" }, { name: "Weekly", color: "green" }, { name: "Monthly", color: "purple" }] } },
  "Period Start": { date: {} },
  "Period End": { date: {} },
  "Generated At": { date: {} },
  Content: { rich_text: {} }
});

console.log([
  `NOTION_USERS_DB_ID=${users.id}`,
  `NOTION_DAILY_CHECKINS_DB_ID=${checkins.id}`,
  `NOTION_TRADE_JOURNAL_DB_ID=${trades.id}`,
  `NOTION_GOALS_DB_ID=${goals.id}`,
  `NOTION_DISCIPLINE_LOGS_DB_ID=${discipline.id}`,
  `NOTION_REPORTS_DB_ID=${reports.id}`
].join("\n"));

async function createDatabase(title: string, properties: Record<string, any>) {
  return notion.databases.create({
    parent: { page_id: env.NOTION_PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: title } }],
    properties
  });
}

