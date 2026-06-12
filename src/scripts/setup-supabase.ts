/**
 * setup-supabase.ts
 *
 * Verifies your Supabase connection and confirms all required tables exist.
 * Run this once after applying supabase/schema.sql:
 *
 *   npx tsx src/scripts/setup-supabase.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.");
  process.exit(1);
}

const db = createClient(url, key);

const REQUIRED_TABLES = [
  "users",
  "daily_checkins",
  "trades",
  "goals",
  "discipline_logs",
  "reports"
];

console.log("🔍  Checking Supabase connection and schema…\n");

let allOk = true;

for (const table of REQUIRED_TABLES) {
  const { error } = await db.from(table).select("id", { count: "exact", head: true });
  if (error) {
    console.error(`  ❌  ${table.padEnd(20)} ${error.message}`);
    allOk = false;
  } else {
    console.log(`  ✅  ${table}`);
  }
}

console.log();

if (allOk) {
  console.log("✅  All tables found. Your Supabase database is ready.\n");
  console.log("Next steps:");
  console.log("  1. npm run register:commands");
  console.log("  2. npm run dev\n");
} else {
  console.log("❌  Some tables are missing. Run the SQL schema first:");
  console.log("  Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run\n");
  process.exit(1);
}
