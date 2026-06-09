import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = process.env.NEXUS_DB_PATH || path.join(DATA_DIR, 'nexus.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     name TEXT,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'member',
     org_id TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS organizations (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     owner_id TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS agents (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     name TEXT NOT NULL,
     role TEXT,
     description TEXT,
     model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
     provider TEXT NOT NULL DEFAULT 'openai',
     system_prompt TEXT NOT NULL DEFAULT '',
     tools_json TEXT NOT NULL DEFAULT '[]',
     status TEXT NOT NULL DEFAULT 'active',
     temperature REAL NOT NULL DEFAULT 0.7,
     max_tokens INTEGER NOT NULL DEFAULT 1024,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     name TEXT NOT NULL,
     description TEXT,
     status TEXT NOT NULL DEFAULT 'active',
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS workflows (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     project_id TEXT,
     name TEXT NOT NULL,
     description TEXT,
     graph_json TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
     status TEXT NOT NULL DEFAULT 'draft',
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS workflow_runs (
     id TEXT PRIMARY KEY,
     workflow_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     input_json TEXT,
     output_json TEXT,
     error TEXT,
     started_at INTEGER NOT NULL,
     finished_at INTEGER,
     duration_ms INTEGER,
     tokens_used INTEGER DEFAULT 0,
     FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS run_logs (
     id TEXT PRIMARY KEY,
     run_id TEXT NOT NULL,
     node_id TEXT,
     level TEXT NOT NULL DEFAULT 'info',
     message TEXT NOT NULL,
     data_json TEXT,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS api_keys (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     provider TEXT NOT NULL,
     label TEXT,
     ciphertext TEXT NOT NULL,
     iv TEXT NOT NULL,
     tag TEXT NOT NULL,
     last_used_at INTEGER,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS integrations (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     kind TEXT NOT NULL,
     name TEXT NOT NULL,
     config_ciphertext TEXT,
     config_iv TEXT,
     config_tag TEXT,
     status TEXT NOT NULL DEFAULT 'connected',
     created_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
     id TEXT PRIMARY KEY,
     agent_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     input TEXT NOT NULL,
     output TEXT,
     error TEXT,
     model TEXT,
     prompt_tokens INTEGER DEFAULT 0,
     completion_tokens INTEGER DEFAULT 0,
     duration_ms INTEGER,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_runs_workflow ON workflow_runs(workflow_id)`,
  `CREATE INDEX IF NOT EXISTS idx_logs_run ON run_logs(run_id)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id)`,
];

export function runMigrations() {
  const tx = db.transaction(() => {
    for (const sql of MIGRATIONS) db.exec(sql);
  });
  tx();
}

runMigrations();
