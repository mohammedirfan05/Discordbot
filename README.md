# Discord + Notion Trading Accountability System

Discord is the primary interface. Notion is the backend database. Traders use slash commands in Discord; they never need to open Notion.

## Commands

- `/checkin mood sleep_hours energy focus trading_plan` in `#daily-check-in`
- `/trade pair direction entry stop_loss take_profit risk_percent result screenshot_url` in `#trade-journal`
- `/goal goal category deadline` in `#weekly-goals`
- `/goal-status goal_id status` in `#weekly-goals`
- `/discipline followed_plan revenge_traded overtraded broke_risk_rules` in `#discipline-log`
- `/stats`, `/my-week`, `/my-month`, `/leaderboard` in `#progress-tracker`

## Setup

1. Create a Discord application and bot, then invite it with `applications.commands`, `bot`, `Send Messages`, `Read Message History`, and `Use Slash Commands`.
2. Create a Notion integration and grant it access to the parent page where databases should be created.
3. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `NOTION_TOKEN`, and `NOTION_PARENT_PAGE_ID`.
4. Install dependencies with `npm install`.
5. Create Notion databases with `npm run notion:bootstrap`.
6. Copy the printed database IDs into `.env`.
7. Register Discord slash commands with `npm run register:commands`.
8. Start the bot with `npm run dev`.

## Production

Build and run:

```bash
npm ci
npm run build
npm run register:commands
npm start
```

Run it as a long-lived process with PM2, systemd, Docker, Railway, Render, Fly.io, or another Node host. The process must stay online for scheduled reports.

Required production practices:

- Keep `.env` out of git.
- Give the Notion integration access only to the parent page used by this system.
- Use one bot process for scheduled jobs to avoid duplicate reports.
- Back up Notion database exports monthly.

## Architecture

The app uses clean boundaries:

- `src/domain`: typed entities and calculations.
- `src/application`: use-case services and report generation.
- `src/infrastructure/notion`: persistence adapters.
- `src/discord`: slash command definitions and interaction handling.
- `src/jobs`: scheduled daily, weekly, and monthly reports.
- `src/scripts`: one-time setup automation.

See `docs/notion-schema.md` for database properties, relations, and rollups.
