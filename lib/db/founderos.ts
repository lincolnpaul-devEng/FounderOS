import type Database from 'better-sqlite3';

/* ── FounderOS UI merge tables (docs/projects/founderos-ui/SPEC.md §2.2, SCAFFOLD §2) ──
   Additive only: CREATE … IF NOT EXISTS, so opening an older database IS the migration
   (migrateFounderOs below). Read and written through the repos in lib/db-ext/*; zod
   schemas in lib/schemas.ts (fo/data block). None is seeded: a fresh install has no row
   in any of them (AC-11). Chats has no table: it reads agent_messages. */
export const FO_DDL = `
CREATE TABLE IF NOT EXISTS trading_snapshots (
  account_id TEXT NOT NULL,
  account_label TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  account_value_usd REAL NOT NULL,
  buying_power_usd REAL NOT NULL,
  cash_usd REAL NOT NULL,
  day_pnl_usd REAL NOT NULL,
  total_pnl_usd REAL NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (account_id, captured_at)
);
CREATE TABLE IF NOT EXISTS trading_positions (
  account_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_cost_usd REAL NOT NULL,
  market_value_usd REAL NOT NULL,
  unrealized_pnl_usd REAL NOT NULL,
  PRIMARY KEY (account_id, captured_at, symbol)
);
CREATE TABLE IF NOT EXISTS trading_activity (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  account_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL,
  price_usd REAL NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trading_activity_by_at ON trading_activity (at);
CREATE TABLE IF NOT EXISTS trading_analysis (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  account_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  examined INTEGER NOT NULL DEFAULT 0,
  signals INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  rows_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS trading_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  quantity REAL NOT NULL,
  filled_quantity REAL NOT NULL DEFAULT 0,
  dollar_amount_usd REAL,
  limit_price_usd REAL,
  placed_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
-- one row by construction, so an agent can never read one of two sets
CREATE TABLE IF NOT EXISTS trading_limits (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_deployed_capital_usd REAL NOT NULL,
  max_notional_per_trade_usd REAL NOT NULL,
  max_position_pct_of_sleeve REAL NOT NULL,
  max_risk_pct_per_trade REAL NOT NULL,
  max_concurrent_positions INTEGER NOT NULL,
  max_trades_per_day INTEGER NOT NULL,
  min_sleeve_value_usd REAL NOT NULL,
  autopilot INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS client_confirmations (
  client_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  retainer INTEGER NOT NULL DEFAULT 0,
  slack_channel TEXT,
  superset_project TEXT,
  confirmed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS client_work (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  brief TEXT NOT NULL,
  status TEXT NOT NULL,
  superset_workspace TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS client_work_by_client ON client_work (client_id, created_at);
CREATE TABLE IF NOT EXISTS lead_magnets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  offer TEXT NOT NULL DEFAULT '',
  live_url TEXT NOT NULL,
  destination TEXT NOT NULL,
  campaign TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  went_live_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_readings (
  machine TEXT NOT NULL,
  plan TEXT NOT NULL,
  day TEXT NOT NULL,
  model TEXT NOT NULL,
  input INTEGER NOT NULL DEFAULT 0,
  output INTEGER NOT NULL DEFAULT 0,
  cache_write INTEGER NOT NULL DEFAULT 0,
  pushed_at TEXT NOT NULL,
  PRIMARY KEY (machine, plan, day, model)
);
CREATE TABLE IF NOT EXISTS comms_digests (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  body_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS digest_reads (
  digest_id TEXT NOT NULL,
  entry_key TEXT NOT NULL DEFAULT '',
  read_at TEXT NOT NULL,
  PRIMARY KEY (digest_id, entry_key)
);
CREATE TABLE IF NOT EXISTS call_recordings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  started_at TEXT NOT NULL,
  duration_s INTEGER,
  participants_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  transcript_url TEXT,
  UNIQUE (source, external_id)
);
CREATE TABLE IF NOT EXISTS deliverable_decisions (
  run_id TEXT PRIMARY KEY,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  cron_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL DEFAULT 'schedule'
);
CREATE INDEX IF NOT EXISTS cron_runs_by_cron ON cron_runs (cron_id, started_at);
`;

/** Every table FO_DDL creates (tests assert each exists and starts empty). */
export const FO_TABLES = [
  'trading_snapshots', 'trading_positions', 'trading_activity', 'trading_analysis', 'trading_orders', 'trading_limits',
  'client_confirmations', 'client_work', 'lead_magnets', 'usage_readings', 'comms_digests', 'digest_reads',
  'call_recordings', 'deliverable_decisions', 'cron_runs',
] as const;

/**
 * Bring an existing database up to the FounderOS-merge schema. Idempotent:
 * every statement is IF NOT EXISTS, and a cron_runs table made by the
 * 2026-10-06 parts bin (no `trigger` column) gains it in place.
 */
export function migrateFounderOs(db: InstanceType<typeof Database>): void {
  // The parts bin's digest tables had another shape (payload / key). Keep any such rows
  // under *_v0 rather than dropping them, then create the current shape.
  const colsOf = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
  for (const [table, mustHave] of [['comms_digests', 'body_json'], ['digest_reads', 'digest_id']] as const) {
    const cols = colsOf(table);
    if (cols.length > 0 && !cols.includes(mustHave) && colsOf(`${table}_v0`).length === 0) {
      db.exec(`ALTER TABLE ${table} RENAME TO ${table}_v0`);
    }
  }
  db.exec(FO_DDL);
  const cols = (db.prepare('PRAGMA table_info(cron_runs)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('trigger')) db.exec("ALTER TABLE cron_runs ADD COLUMN trigger TEXT NOT NULL DEFAULT 'schedule'");
}
