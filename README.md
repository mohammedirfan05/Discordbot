# TradeOS — Discord Trading Accountability Bot

A Discord bot for trading groups that enforces daily accountability through structured check-ins, trade journaling, goal tracking, and discipline scoring. Built on **Discord.js v14** and **Supabase (PostgreSQL)**.

---

## Commands

| Command | Channel | Description |
|---------|---------|-------------|
| `/checkin` | `#daily-check-in` | Two-step check-in: numbers first, trading plan in a popup modal |
| `/trade` | `#trade-journal` | Log a trade — entry, SL, TP, risk, result |
| `/goal` | `#weekly-goals` | Create a weekly goal with category and deadline |
| `/goal-status` | `#weekly-goals` | Update goal progress (autocomplete on goal name) |
| `/discipline` | `#discipline-log` | End-of-day rule check — 25 pts per rule kept |
| `/stats` | `#progress-tracker` | Quick 3-metric snapshot (discipline / win rate / net P&L) |
| `/my-week` | `#progress-tracker` | Full 7-metric weekly breakdown |
| `/my-month` | `#progress-tracker` | Full 7-metric monthly breakdown |
| `/leaderboard` | `#progress-tracker` | Weekly group ranking |
| `/help` | anywhere | Shows all commands and required channels (ephemeral) |

---

## Setup

### 1. Supabase (database)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → **New query** → paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Discord

1. Create an application at [discord.com/developers](https://discord.com/developers/applications).
2. Add a Bot → copy the token → `DISCORD_TOKEN`.
3. Copy the Application ID → `DISCORD_CLIENT_ID`.
4. Invite the bot to your server with scopes: `bot`, `applications.commands`.  
   Permissions: **Send Messages**, **Embed Links**, **Read Message History**, **Use Slash Commands**.
5. Copy your server ID → `DISCORD_GUILD_ID`.
6. Copy each accountability channel's ID into the matching `CHANNEL_*` variable.

### 3. Environment

```bash
cp .env.example .env
# Fill in every value in .env
```

### 4. Install & run

```bash
npm install

# Verify Supabase tables were created correctly
npm run supabase:setup

# Register slash commands with Discord
npm run register:commands

# Start the bot
npm run dev
```

---

## Production (Railway / Fly.io / Koyeb)

```bash
npm ci
npm run build
npm run register:commands   # run once before first deploy
npm start
```

Set all `.env` variables in your hosting platform's environment dashboard. The process must stay alive 24/7 for scheduled reports and reminders.

**Railway** (recommended): connect your GitHub repo, add env vars in the Variables tab, done.

---

## Architecture

```
src/
├── config/        env validation (Zod), logger
├── domain/        pure types + calculation logic (metrics, date ranges)
├── application/   use-case services (AccountabilityService, ReportService)
├── infrastructure/
│   └── supabase/  database client, typed repository, DB type definitions
├── discord/       slash command definitions, interaction handler, bot client
└── jobs/          cron schedulers (reports + reminders)

supabase/
└── schema.sql     PostgreSQL schema — run this once to set up the DB
```

**Key design decisions:**
- The repository layer (`SupabaseRepositories`) is the only place that touches the database.
- Domain logic (RR calculation, discipline scoring, stats aggregation) lives in pure functions under `src/domain/` — no DB dependency.
- Swapping the database again only requires replacing `src/infrastructure/supabase/`.

---

## Scheduled Jobs

| Job | Default schedule | Description |
|-----|-----------------|-------------|
| Daily report | 10pm every day | Posts all-user stats to `#reports` |
| Weekly report | 8pm every Sunday | Weekly leaderboard summary |
| Monthly report | 8pm on the 1st | Monthly leaderboard summary |
| Check-in reminder | 9am Mon–Fri | Mentions users with no check-in today |
| Discipline reminder | 6pm Mon–Fri | Mentions users with no discipline log today |

Reminder jobs only run if `CHANNEL_REMINDERS_ID` is set in your environment.  
All schedules respect the configured `TIMEZONE` (default: `Asia/Kolkata`).
