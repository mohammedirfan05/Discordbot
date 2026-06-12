# Supabase Schema

TradeOS stores application data in PostgreSQL through Supabase. The canonical schema is [`supabase/schema.sql`](../supabase/schema.sql).

Run that file once in the Supabase SQL Editor when creating a new environment.

## Tables

| Table | Purpose |
| --- | --- |
| `users` | Discord user identity and active status |
| `daily_checkins` | Daily mood, sleep, energy, focus, and trading plans |
| `trades` | Trade journal entries and execution details |
| `goals` | User goals, deadlines, and completion state |
| `discipline_logs` | Daily rule adherence records |
| `reports` | Generated report metadata and content |

## Relationships

User-owned records reference `users.discord_user_id`. Deleting a user cascades to related check-ins, trades, goals, and discipline logs.

Daily check-ins and discipline logs each enforce one record per Discord user and date. Goal IDs are unique and intended for application-level lookup.

## Access Model

The bot connects with `SUPABASE_SERVICE_ROLE_KEY`. This key has privileged database access and must be used only by the server process.

Do not:

- Commit the service role key
- Place it in client-side JavaScript
- Include it in screenshots or deployment archives
- Expose it through logs or Discord messages

Store it in `.env` for local development and in host-managed secrets for production.

## Verification

After applying the schema, run:

```bash
npm run supabase:setup
```

The command performs read-only checks against every required table.

## Schema Changes

Treat `supabase/schema.sql` as the source of truth for new project setup. When changing the database:

1. Update the SQL schema.
2. Update the TypeScript database types and repository implementation.
3. Test against a non-production Supabase project.
4. Plan an explicit migration for existing production data.
