-- New Level Multi-Agentics — durable storage schema (better-sqlite3).
-- Runtime state lives in memory for speed; these tables give the platform
-- durability so runs, logs and artifacts survive a restart. Rich objects are
-- stored as JSON in a `data` column and re-hydrated on boot.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS runs (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL,
  title       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  finished_at INTEGER,
  version     INTEGER NOT NULL DEFAULT 0,
  data        TEXT NOT NULL            -- full Run JSON snapshot
);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id        TEXT PRIMARY KEY,
  run_id    TEXT NOT NULL,
  status    TEXT NOT NULL,
  team_kind TEXT NOT NULL,
  data      TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tasks_run ON tasks(run_id);

CREATE TABLE IF NOT EXISTS logs (
  id       TEXT PRIMARY KEY,
  ts       INTEGER NOT NULL,
  run_id   TEXT,
  source   TEXT NOT NULL,
  severity TEXT NOT NULL,
  message  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_run ON logs(run_id);

CREATE TABLE IF NOT EXISTS artifacts (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL,
  path       TEXT NOT NULL,
  language   TEXT NOT NULL,
  lines      INTEGER NOT NULL,
  bytes      INTEGER NOT NULL,
  task_id    TEXT,
  preview    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);

CREATE TABLE IF NOT EXISTS deployments (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL,
  environment TEXT NOT NULL,
  status      TEXT NOT NULL,
  url         TEXT NOT NULL,
  version     INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  lines       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_deploy_run ON deployments(run_id);

CREATE TABLE IF NOT EXISTS memory (
  id         TEXT PRIMARY KEY,
  run_id     TEXT,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  scope      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);

CREATE TABLE IF NOT EXISTS vectors (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  text      TEXT NOT NULL,
  source    TEXT NOT NULL,
  tags      TEXT NOT NULL,            -- JSON array
  embedding TEXT NOT NULL            -- JSON number[]
);

CREATE TABLE IF NOT EXISTS approvals (
  id         TEXT PRIMARY KEY,
  run_id     TEXT NOT NULL,
  status     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
