# TradeOS — Usage Guide

This is a Discord bot for trading accountability groups. All day-to-day work happens inside Discord using slash commands. **Supabase (PostgreSQL)** is the database — you never need to open it directly.

---

## What the bot does

- Records daily check-ins, trades, goals, and discipline logs in Supabase.
- Calculates and displays personal stats (discipline score, win rate, RR, P&L).
- Posts scheduled daily/weekly/monthly reports to your reports channel.
- Sends morning and evening reminders to users who haven't logged yet.
- Shows a weekly leaderboard across all active traders.

---

## One-time setup

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project** (free tier is enough).
2. Once created, go to **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` from this project and paste the entire contents into the editor.
4. Click **Run**. This creates all 6 tables.
5. Go to **Settings → API** and copy:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role** secret key → this is your `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ Use the `service_role` key, not the `anon` key. The service role key has full access and is safe to use server-side only. Keep it secret.

### Step 3 — Create your Discord application

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**.
2. Go to **Bot** → **Add Bot** → copy the token → `DISCORD_TOKEN`.
3. Copy the **Application ID** → `DISCORD_CLIENT_ID`.
4. Go to your Discord server → right-click the server name → **Copy Server ID** → `DISCORD_GUILD_ID`.
5. Invite the bot using OAuth2 with scopes: `bot` + `applications.commands`.  
   Required permissions: **Send Messages**, **Embed Links**, **Read Message History**, **Use Slash Commands**.

### Step 4 — Set up your .env file

```bash
cp .env.example .env
```

Fill in every value. Required variables:

| Variable | Where to find it |
|----------|-----------------|
| `DISCORD_TOKEN` | Discord Developer Portal → Bot |
| `DISCORD_CLIENT_ID` | Discord Developer Portal → General Information |
| `DISCORD_GUILD_ID` | Discord → right-click server → Copy ID |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `CHANNEL_DAILY_CHECK_IN_ID` | Discord → right-click channel → Copy ID |
| `CHANNEL_TRADE_JOURNAL_ID` | Discord → right-click channel → Copy ID |
| `CHANNEL_WEEKLY_GOALS_ID` | Discord → right-click channel → Copy ID |
| `CHANNEL_DISCIPLINE_LOG_ID` | Discord → right-click channel → Copy ID |
| `CHANNEL_PROGRESS_TRACKER_ID` | Discord → right-click channel → Copy ID |
| `CHANNEL_REPORTS_ID` | Discord → right-click channel → Copy ID |

Optional:

| Variable | Purpose |
|----------|---------|
| `CHANNEL_REMINDERS_ID` | Enable morning + evening reminder pings |
| `TIMEZONE` | Your timezone (default: `Asia/Kolkata`) |

To copy channel IDs in Discord: **User Settings → Advanced → Developer Mode ON** → right-click any channel → **Copy Channel ID**.

### Step 5 — Verify Supabase setup

```bash
npm run supabase:setup
```

This checks that all 6 tables exist. If any are missing, re-run the SQL schema.

### Step 6 — Register slash commands

```bash
npm run register:commands
```

Run this once (and again whenever command definitions change). Commands appear in Discord within a few seconds.

### Step 7 — Start the bot

```bash
npm run dev
```

The bot is now live. You should see `Discord bot ready` in the logs.

---

## Command reference

### `/checkin` — `#daily-check-in`

**Two-step flow:**
1. Run `/checkin mood:8 sleep_hours:7 energy:8 focus:9`
2. A private message appears with your numbers and an **"Add Trading Plan"** button.
3. Click the button → a popup appears where you type your plan.
4. Submit → your full check-in is saved and posted publicly in the channel.

### `/trade` — `#trade-journal`

```
/trade pair:MNQ direction:Long entry:21000 stop_loss:20950 take_profit:21100 risk_percent:1 result:Win
```

- `pair` is a dropdown: **MNQ** (Micro Nasdaq) or **ES** (Micro E-mini S&P 500)
- `result` choices: Win, Loss, Break Even, Open
- `screenshot_url` is optional — paste a chart image URL and it embeds in the reply

The bot automatically calculates your **RR** and **performance R** from the prices you enter.

### `/goal` — `#weekly-goals`

```
/goal goal:"No revenge trades this week" category:Psychology deadline:2026-06-15
```

- `category` is a dropdown: Execution, Risk Management, Psychology, Analysis, Journaling, Other
- `deadline` must be `YYYY-MM-DD` format
- The bot shows a **Goal ID** in the confirmation — you don't need to remember it, autocomplete finds it

### `/goal-status` — `#weekly-goals`

```
/goal-status goal_id:[start typing your goal name] status:Completed
```

The `goal_id` field has **autocomplete** — just start typing any words from your goal and select it from the dropdown. No need to copy IDs manually.

### `/discipline` — `#discipline-log`

```
/discipline followed_plan:True revenge_traded:False overtraded:False broke_risk_rules:False
```

**Scoring:**
- Followed plan: +25
- No revenge trading: +25
- No overtrading: +25
- No broken risk rules: +25
- **Max: 100/100**

### `/stats` — `#progress-tracker`

Quick 3-metric snapshot for this week: **Discipline %**, **Win Rate %**, **Net P&L (R)**.

### `/my-week` — `#progress-tracker`

Full breakdown: discipline, win rate, average RR, net performance, goals completed, check-in consistency, total trades.

### `/my-month` — `#progress-tracker`

Same as `/my-week` but for the current calendar month.

### `/leaderboard` — `#progress-tracker`

Weekly ranking of all active traders. Score is a weighted composite of discipline, win rate, consistency, performance, and goals.

### `/help` — anywhere

Shows all commands and their required channels. Only visible to you (ephemeral).

---

## Scheduled reports & reminders

| Time | Job |
|------|-----|
| 9am Mon–Fri | Mentions users who haven't checked in yet (in `#reminders`) |
| 6pm Mon–Fri | Mentions users who haven't logged discipline yet (in `#reminders`) |
| 10pm daily | Daily report posted to `#reports` |
| 8pm every Sunday | Weekly report |
| 8pm on the 1st | Monthly report |

All times respect your `TIMEZONE` env var (default: `Asia/Kolkata`).  
Reminders only fire if `CHANNEL_REMINDERS_ID` is set.

---

## Hosting (24/7)

For always-on hosting, use **Railway**, **Fly.io**, or **Koyeb** (all have free tiers).

**Railway (easiest):**
1. Push code to GitHub.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
3. Add all env vars in the **Variables** tab.
4. Railway auto-deploys on every push. Done.

Production build:

```bash
npm ci
npm run build
npm start
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Bot doesn't respond to commands | Run `npm run register:commands` again and wait 30s |
| "This command can only be used in #channel" | You're in the wrong channel |
| Check-in/discipline says "already submitted today" | You already logged today — one per day per user |
| Stats show 0% everything | No data logged for the current period yet |
| Bot starts but crashes immediately | Check logs — likely a missing env var |
| Supabase error on startup | Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct |
