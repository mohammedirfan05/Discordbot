# TradeOS Usage Guide

This guide covers initial setup and normal use of TradeOS. For architecture and production notes, see the main [README](./README.md).

## Initial Setup

### Install

```bash
npm install
```

### Prepare Supabase

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run [`supabase/schema.sql`](./supabase/schema.sql).
4. Copy the project URL into `SUPABASE_URL`.
5. Copy the service role key into `SUPABASE_SERVICE_ROLE_KEY`.

Verify the connection:

```bash
npm run supabase:setup
```

A successful check confirms that the credentials work and that all required tables exist.

### Prepare Discord

Create a Discord application and bot, then collect:

- Bot token
- Application ID
- Server ID
- IDs for each configured channel

Invite the bot with the `bot` and `applications.commands` scopes. Grant Send Messages, Embed Links, Read Message History, and Use Application Commands permissions.

### Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

Fill in all required values. Keep `.env` private. It is excluded from Git and must not be uploaded as a deployment artifact.

Register the commands:

```bash
npm run register:commands
```

Start the bot:

```bash
npm run dev
```

## Daily Workflow

### Morning Check-In

Run `/checkin` in the daily check-in channel.

1. Enter mood, sleep hours, energy, and focus.
2. Submit the command.
3. Select **Add Trading Plan**.
4. Enter the plan in the modal and submit it.

Only one check-in can be recorded per user per day.

### Record Trades

Run `/trade` in the trade journal channel.

Required information includes:

- Trading pair
- Direction
- Entry price
- Stop loss
- Take profit
- Risk percentage
- Result

A screenshot URL is optional. TradeOS calculates planned risk-to-reward and performance in R.

### End-of-Day Discipline

Run `/discipline` in the discipline channel and answer each rule question.

The score awards 25 points for each condition:

- Followed the trading plan
- Did not revenge trade
- Did not overtrade
- Did not break risk rules

Only one discipline log can be recorded per user per day.

## Goal Workflow

Create a goal with `/goal` in the weekly goals channel. Provide the goal text, category, and deadline in `YYYY-MM-DD` format.

Use `/goal-status` to update it. Begin typing the goal name in the goal field, select the matching autocomplete result, and choose the new status.

## Performance Commands

Run these commands in the progress tracker channel:

| Command | Result |
| --- | --- |
| `/stats` | Quick weekly discipline, win rate, and net performance |
| `/my-week` | Detailed current-week metrics |
| `/my-month` | Detailed current-month metrics |
| `/leaderboard` | Current weekly group ranking |

Use `/help` in any channel to view command guidance privately.

## Scheduled Activity

TradeOS can send:

- Weekday morning check-in reminders
- Weekday evening discipline reminders
- Daily reports
- Weekly reports
- Monthly reports

Schedules use the configured `TIMEZONE`. Reminders require `CHANNEL_REMINDERS_ID`.

## Production Commands

```bash
npm ci
npm run build
npm start
```

The production host must keep a Node.js process running continuously because the bot maintains a Discord Gateway connection.

Configure secrets through the hosting platform. Do not upload `.env`.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Bot does not appear online | Confirm the process is running and `DISCORD_TOKEN` is valid |
| Slash commands are missing | Run `npm run register:commands` and confirm `DISCORD_GUILD_ID` |
| Command is rejected in a channel | Use the channel configured for that command |
| Supabase verification fails | Confirm the URL, service role key, and schema setup |
| A daily entry is rejected as duplicate | Only one check-in and discipline log are allowed per user per day |
| Reports or reminders do not run | Confirm the process remains online, timezone is valid, and channel IDs are correct |
| Metrics are empty | Record activity within the current reporting period |
