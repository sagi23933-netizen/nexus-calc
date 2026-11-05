import Database from 'better-sqlite3';
import { config } from './config.js';

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','business')),
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'Tag',
  color TEXT NOT NULL DEFAULT '#7cc22a',
  ai_hint TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'subscription' CHECK (kind IN ('subscription','tokens')),
  subtitle TEXT NOT NULL DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  compare_price REAL,
  period TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month','year','once')),
  tokens INTEGER NOT NULL DEFAULT 0,
  priority_listing INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT '{}',
  rows TEXT NOT NULL DEFAULT '[]',
  stickers TEXT NOT NULL DEFAULT '[]',
  cta_text TEXT NOT NULL DEFAULT 'בחירת חבילה',
  is_active INTEGER NOT NULL DEFAULT 1,
  show_on_site INTEGER NOT NULL DEFAULT 1,
  show_in_dashboard INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
  logo_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  waze_url TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  website TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','blocked','suspended')),
  source TEXT NOT NULL DEFAULT 'site' CHECK (source IN ('site','admin')),
  trial_days INTEGER NOT NULL DEFAULT 3,
  trial_started_at TEXT,
  trial_ends_at TEXT,
  trial_warning_sent INTEGER NOT NULL DEFAULT 0,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  period_start TEXT,
  period_end TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  renewal_warning_sent INTEGER NOT NULL DEFAULT 0,
  past_due_since TEXT,
  token_balance INTEGER NOT NULL DEFAULT 0,
  daily_tokens INTEGER NOT NULL DEFAULT 0,
  daily_tokens_date TEXT,
  card_brand TEXT NOT NULL DEFAULT '',
  card_last4 TEXT NOT NULL DEFAULT '',
  card_exp TEXT NOT NULL DEFAULT '',
  card_holder TEXT NOT NULL DEFAULT '',
  card_token TEXT NOT NULL DEFAULT '',
  blocked_reason TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biz_status ON businesses(status);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  original_price REAL NOT NULL,
  discount_percent REAL NOT NULL,
  final_price REAL NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  duration_hours REAL NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('scheduled','active')),
  design TEXT NOT NULL DEFAULT '{}',
  design_source TEXT NOT NULL DEFAULT 'builtin',
  ai_model TEXT NOT NULL DEFAULT '',
  redesigns INTEGER NOT NULL DEFAULT 0,
  show_phone INTEGER NOT NULL DEFAULT 1,
  show_address INTEGER NOT NULL DEFAULT 1,
  show_waze INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  clicks_phone INTEGER NOT NULL DEFAULT 0,
  clicks_waze INTEGER NOT NULL DEFAULT 0,
  clicks_share INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deals_exp ON deals(expires_at);
CREATE INDEX IF NOT EXISTS idx_deals_biz ON deals(business_id);

CREATE TABLE IF NOT EXISTS deal_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_price REAL NOT NULL,
  discount_percent REAL NOT NULL,
  final_price REAL NOT NULL,
  duration_hours REAL NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  end_reason TEXT NOT NULL DEFAULT 'expired',
  category_id INTEGER,
  city_id INTEGER,
  design_source TEXT NOT NULL DEFAULT 'builtin',
  views INTEGER NOT NULL DEFAULT 0,
  clicks_phone INTEGER NOT NULL DEFAULT 0,
  clicks_waze INTEGER NOT NULL DEFAULT 0,
  clicks_share INTEGER NOT NULL DEFAULT 0,
  feedback TEXT CHECK (feedback IN ('yes','no')),
  feedback_customers INTEGER,
  feedback_note TEXT NOT NULL DEFAULT '',
  feedback_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hist_biz ON deal_history(business_id);

CREATE TABLE IF NOT EXISTS token_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  pool TEXT NOT NULL DEFAULT 'balance' CHECK (pool IN ('balance','daily')),
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  ref_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tok_biz ON token_transactions(business_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('subscription','tokens','renewal')),
  amount REAL NOT NULL,
  vat REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ILS',
  status TEXT NOT NULL CHECK (status IN ('paid','failed','refunded')),
  provider TEXT NOT NULL DEFAULT 'demo',
  provider_ref TEXT NOT NULL DEFAULT '',
  card_last4 TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  failure_reason TEXT NOT NULL DEFAULT '',
  invoice_number TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pay_created ON payments(created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audience TEXT NOT NULL CHECK (audience IN ('business','admin')),
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  emailed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_biz ON notifications(business_id, read_at);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'dashboard' CHECK (source IN ('dashboard','site')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  unread_admin INTEGER NOT NULL DEFAULT 1,
  unread_business INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('business','admin','guest')),
  user_id INTEGER,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  visitor_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  deal_id INTEGER,
  business_id INTEGER,
  category_id INTEGER,
  city_id INTEGER,
  referrer TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ev_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ev_type ON analytics_events(type, created_at);

CREATE TABLE IF NOT EXISTS ai_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic','builtin')),
  model_id TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  effort TEXT NOT NULL DEFAULT 'low',
  max_tokens INTEGER NOT NULL DEFAULT 16000,
  system_prompt TEXT NOT NULL DEFAULT '',
  creativity TEXT NOT NULL DEFAULT 'balanced',
  is_active INTEGER NOT NULL DEFAULT 0,
  last_test_at TEXT,
  last_test_ok INTEGER,
  last_test_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ai_model_id INTEGER,
  provider TEXT NOT NULL,
  model_id TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL,
  business_id INTEGER,
  deal_id INTEGER,
  success INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id INTEGER,
  details TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
`;

db.exec(SCHEMA);

export const tx = (fn) => db.transaction(fn);
export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
