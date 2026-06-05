import "dotenv/config";
import { Client } from "@notionhq/client";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN is not set in your environment. Set it in .env or export it and retry.");
  process.exit(1);
}

const notion = new Client({ auth: token });

const expected = [
  { key: "NOTION_USERS_DB_ID", names: ["users"] },
  { key: "NOTION_DAILY_CHECKINS_DB_ID", names: ["daily checkins", "daily-checkins", "daily checkins"] },
  { key: "NOTION_TRADE_JOURNAL_DB_ID", names: ["trade journal", "trade-journal"] },
  { key: "NOTION_GOALS_DB_ID", names: ["goals"] },
  { key: "NOTION_DISCIPLINE_LOGS_DB_ID", names: ["discipline logs", "discipline-logs"] },
  { key: "NOTION_REPORTS_DB_ID", names: ["reports"] }
];

function titleOfDatabase(db: any) {
  if (!db || !db.title) return "";
  try {
    if (Array.isArray(db.title)) {
      return db.title.map((t: any) => (t.plain_text ?? t.text?.content ?? "")).join(" ").trim();
    }
    if (typeof db.title === "string") return db.title;
  } catch (e) {
    return "";
  }
  return "";
}

async function listDatabases() {
  const found: Record<string, string> = {};

  // Fetch databases via search
  let cursor: string | undefined = undefined;
  const all: any[] = [];
  do {
    const res = await notion.search({
      start_cursor: cursor,
      filter: { property: "object", value: "database" },
      page_size: 100
    });
    if (res.results) all.push(...res.results);
    cursor = (res as any).next_cursor ?? undefined;
  } while (cursor);

  // Normalize titles
  const normalized = all.map((db) => ({
    id: db.id,
    title: titleOfDatabase(db),
    raw: db
  }));

  for (const want of expected) {
    const match = normalized.find((d) => {
      const t = (d.title || "").toLowerCase();
      return want.names.some((n) => t === n || t.includes(n));
    });
    if (match) found[want.key] = match.id;
    else found[want.key] = "";
  }

  // Print as env lines
  console.log([
    `NOTION_USERS_DB_ID=${found.NOTION_USERS_DB_ID}`,
    `NOTION_DAILY_CHECKINS_DB_ID=${found.NOTION_DAILY_CHECKINS_DB_ID}`,
    `NOTION_TRADE_JOURNAL_DB_ID=${found.NOTION_TRADE_JOURNAL_DB_ID}`,
    `NOTION_GOALS_DB_ID=${found.NOTION_GOALS_DB_ID}`,
    `NOTION_DISCIPLINE_LOGS_DB_ID=${found.NOTION_DISCIPLINE_LOGS_DB_ID}`,
    `NOTION_REPORTS_DB_ID=${found.NOTION_REPORTS_DB_ID}`
  ].join("\n"));

  // Helpful detail: list found DBs
  console.log("\nFound databases:");
  normalized.forEach((d) => console.log(`- ${d.title || "(untitled)"}: ${d.id}`));
}

listDatabases().catch((err) => {
  console.error("Error listing databases:", err);
  process.exit(1);
});
