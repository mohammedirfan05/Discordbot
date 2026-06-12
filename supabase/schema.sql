-- ============================================================
--  TradeOS — Supabase Schema
--  Run this entire file in the Supabase SQL Editor once.
--  Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id   TEXT        UNIQUE NOT NULL,
  discord_username  TEXT        NOT NULL,
  active            BOOLEAN     NOT NULL DEFAULT TRUE,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Daily Check-ins ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_checkins (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id  TEXT        NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  mood             SMALLINT    NOT NULL CHECK (mood    BETWEEN 1 AND 10),
  sleep_hours      NUMERIC(4,1) NOT NULL CHECK (sleep_hours BETWEEN 0 AND 24),
  energy           SMALLINT    NOT NULL CHECK (energy  BETWEEN 1 AND 10),
  focus            SMALLINT    NOT NULL CHECK (focus   BETWEEN 1 AND 10),
  trading_plan     TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discord_user_id, date)
);

-- ── Trade Journal ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id  TEXT        NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  pair             TEXT        NOT NULL,
  direction        TEXT        NOT NULL CHECK (direction   IN ('Long', 'Short')),
  entry            NUMERIC     NOT NULL,
  stop_loss        NUMERIC     NOT NULL,
  take_profit      NUMERIC     NOT NULL,
  risk_percent     NUMERIC     NOT NULL CHECK (risk_percent BETWEEN 0.01 AND 10),
  result           TEXT        NOT NULL CHECK (result      IN ('Win', 'Loss', 'BE', 'Open')),
  screenshot_url   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Goals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id          TEXT        UNIQUE NOT NULL,    -- human-readable ID shown in Discord
  discord_user_id  TEXT        NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  goal_text        TEXT        NOT NULL,
  category         TEXT        NOT NULL,
  deadline         DATE        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'Not Started'
                               CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Blocked')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- ── Discipline Logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discipline_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id   TEXT        NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  date              DATE        NOT NULL,
  followed_plan     BOOLEAN     NOT NULL,
  revenge_traded    BOOLEAN     NOT NULL,
  overtraded        BOOLEAN     NOT NULL,
  broke_risk_rules  BOOLEAN     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (discord_user_id, date)
);

-- ── Reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT        NOT NULL CHECK (type IN ('Daily', 'Weekly', 'Monthly')),
  period_start  DATE        NOT NULL,
  period_end    DATE        NOT NULL,
  content       TEXT        NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes (improves query performance for date-range lookups) ─
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date    ON daily_checkins   (discord_user_id, date);
CREATE INDEX IF NOT EXISTS idx_trades_user_date            ON trades           (discord_user_id, date);
CREATE INDEX IF NOT EXISTS idx_goals_user_status           ON goals            (discord_user_id, status);
CREATE INDEX IF NOT EXISTS idx_discipline_logs_user_date   ON discipline_logs  (discord_user_id, date);

-- ── Learning Sessions ──────────────────────────────────────────
-- An active session has ended_at = NULL.
-- Calling /learn stop sets ended_at and duration_minutes.
CREATE TABLE IF NOT EXISTS learning_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id   TEXT        NOT NULL REFERENCES users(discord_user_id) ON DELETE CASCADE,
  topic             TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_minutes  INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_user ON learning_sessions (discord_user_id, started_at DESC);

