# TradeOS

TradeOS is a Discord trading accountability bot built with Discord.js, TypeScript, and Supabase. It gives trading groups a structured workflow for daily check-ins, trade journaling, weekly goals, discipline tracking, reports, reminders, and leaderboards.

All user activity happens through Discord slash commands. Supabase provides persistent PostgreSQL storage.

## Features

- Guided daily check-ins with a trading plan modal
- Trade journal with automatic risk-to-reward calculations
- Weekly goal creation and status tracking
- Daily discipline scoring
- Weekly and monthly performance summaries
- Group leaderboards
- Scheduled reports and reminders
- Typed Supabase repository layer

## Commands

| Command | Channel | Purpose |
| --- | --- | --- |
| `/checkin` | `#daily-check-in` | Record mood, sleep, energy, focus, and a trading plan |
| `/trade` | `#trade-journal` | Record a trade and calculate its performance |
| `/goal` | `#weekly-goals` | Create a goal with a category and deadline |
| `/goal-status` | `#weekly-goals` | Update an existing goal using autocomplete |
| `/discipline` | `#discipline-log` | Record whether trading rules were followed |
| `/stats` | `#progress-tracker` | Show a quick weekly performance summary |
| `/my-week` | `#progress-tracker` | Show the current week's full breakdown |
| `/my-month` | `#progress-tracker` | Show the current month's full breakdown |
| `/leaderboard` | `#progress-tracker` | Show the weekly group ranking |
| `/help` | Any channel | Show command and channel guidance privately |

## Requirements

- Node.js 20 or newer
- A Discord application and bot
- A Supabase project
- A Discord server where you can manage channels and applications

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database

1. Create a project at [Supabase](https://supabase.com/).
2. Open the Supabase SQL Editor.
3. Run the complete [`supabase/schema.sql`](./supabase/schema.sql) file.
4. Open your project API settings.
5. Copy the project URL and service role key.

The service role key bypasses Row Level Security and must remain server-side. Never commit it or expose it in browser code.

### 3. Configure Discord

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Add a bot and copy its token.
3. Invite it with the `bot` and `applications.commands` scopes.
4. Grant it Send Messages, Embed Links, Read Message History, and Use Application Commands permissions.
5. Enable Developer Mode in Discord so you can copy the server and channel IDs.

### 4. Configure the environment

Copy `.env.example` to `.env`, then fill in the required values:

```bash
cp .env.example .env
```

Important variables:

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_CLIENT_ID` | Discord application ID |
| `DISCORD_GUILD_ID` | Target Discord server ID |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key |
| `CHANNEL_*` | Discord channel IDs used by each workflow |
| `TIMEZONE` | Timezone used by scheduled jobs |

The repository ignores `.env`. Keep production secrets in your hosting provider's secret or environment variable settings.

### 5. Verify and run

```bash
# Confirm that Supabase is reachable and all required tables exist
npm run supabase:setup

# Publish slash commands to the configured Discord server
npm run register:commands

# Start the development process
npm run dev
```

## Production

Build and run the compiled application:

```bash
npm ci
npm run build
npm start
```

Run `npm run register:commands` once before the first deployment and whenever command definitions change.

This bot uses the Discord Gateway, so the host must support a continuously running Node.js process and outbound WebSocket connections. Request-based platforms such as Cloudflare Workers, Vercel Functions, and Netlify Functions cannot run this application without an architectural rewrite.

The local filesystem is not used as the source of truth. Application data remains in Supabase across restarts and deployments.

## Scheduled Jobs

| Job | Default schedule | Destination |
| --- | --- | --- |
| Check-in reminder | 9:00 AM, Monday to Friday | Reminders channel |
| Discipline reminder | 6:00 PM, Monday to Friday | Reminders channel |
| Daily report | 10:00 PM daily | Reports channel |
| Weekly report | 8:00 PM every Sunday | Reports channel |
| Monthly report | 8:00 PM on the first day of each month | Reports channel |

Schedules use `TIMEZONE`, which defaults to `Asia/Kolkata`. Reminder jobs are enabled only when `CHANNEL_REMINDERS_ID` is configured.

## Project Structure

```text
src/
|-- application/          Use-case and reporting services
|-- config/               Environment validation and logging
|-- discord/              Bot client, commands, and interaction handling
|-- domain/               Domain types, date ranges, and metrics
|-- infrastructure/
|   `-- supabase/         Supabase client, database types, and repositories
|-- jobs/                 Scheduled reports and reminders
`-- scripts/              Setup and verification scripts

supabase/
`-- schema.sql            PostgreSQL schema
```

## Security

- Never commit `.env`.
- Never expose `DISCORD_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY`.
- Store production credentials as host-managed secrets.
- Rotate a credential immediately if it appears in Git history, logs, screenshots, or deployment archives.
- Review staged files with `git diff --cached` before pushing.

## Documentation

- [Usage guide](./instruction.md)
- [Supabase schema](./docs/supabase-schema.md)
