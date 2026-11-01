import type Database from 'better-sqlite3';

/* ── Content Lab tables (docs/projects/content-lab/SPEC.md §6, CONTRACT.md) ──────────
   Additive only: CREATE … IF NOT EXISTS, never altered in place. Read and written
   through lib/lab/store.ts (labStore); nothing else touches lab_* directly. Measures,
   profiles and trend snapshots are derived and can be rebuilt from posts, metrics and
   dissections. Exported so the sample preview can build the same schema in memory. */
/* ── Content Lab v2 tables (S0; docs/projects/content-lab/v2/SPEC.md 3.4, 08.11.2) ──────────
   Appended to LAB_DDL below. Additive only (CREATE ... IF NOT EXISTS). Each table names its
   DDL owner section. Columns added to v1 tables are NOT here: they are LAB_V2_COLUMNS, applied
   by the one migrateLabV2 (indexes on those columns are created there too, after the column). */
export const LAB_V2_DDL = `
-- 04 section 8
CREATE TABLE IF NOT EXISTS lab_controls (
  post_id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  stratum TEXT NOT NULL,
  sampling_prob REAL NOT NULL,
  eligible_n INTEGER NOT NULL DEFAULT 0,
  drawn_n INTEGER NOT NULL DEFAULT 0,
  seed TEXT NOT NULL,
  verdict_age_h REAL NOT NULL,
  verdict_ratio REAL,
  drawn_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'selected',
  measure_version TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lab_controls_stratum ON lab_controls (stratum);
-- 05 section 16
CREATE TABLE IF NOT EXISTS lab_events (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  vendor TEXT,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'candidate',
  merged_into TEXT,
  dismiss_reason TEXT,
  novelty TEXT,
  novelty_source TEXT,
  class TEXT NOT NULL DEFAULT 'unknown',
  class_basis TEXT,
  class_json TEXT NOT NULL DEFAULT '{}',
  wiki_article TEXT,
  attention_json TEXT NOT NULL DEFAULT '[]',
  t0 TEXT,
  t0_rule TEXT,
  t0_ping_id TEXT,
  t0_revised_at TEXT,
  confirmed_at TEXT,
  first_seen_at TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  sources_json TEXT NOT NULL DEFAULT '[]',
  wave_n INTEGER NOT NULL DEFAULT 1,
  wave_started_at TEXT,
  window_state TEXT,
  window_opens_at TEXT,
  window_closing_at TEXT,
  window_closes_at TEXT,
  window_changed_at TEXT,
  window_reason TEXT,
  window_log_json TEXT NOT NULL DEFAULT '[]',
  cluster_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS lab_events_key ON lab_events (key) WHERE status NOT IN ('merged','dismissed');
CREATE INDEX IF NOT EXISTS lab_events_state ON lab_events (status, window_state, t0);
CREATE TABLE IF NOT EXISTS lab_event_pings (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  family TEXT NOT NULL,
  external_id TEXT NOT NULL,
  event_id TEXT,
  match_rule TEXT,
  name TEXT,
  name_key TEXT,
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  author TEXT,
  vendor TEXT,
  source_time TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  prev_seen_at TEXT,
  metric_first REAL,
  metric_prev REAL,
  metric_last REAL,
  rank INTEGER,
  velocity_per_h REAL,
  robust_z REAL,
  is_launch INTEGER NOT NULL DEFAULT 0,
  is_baseline INTEGER NOT NULL DEFAULT 0,
  qualifies INTEGER NOT NULL DEFAULT 0,
  qualify_reason TEXT,
  fake_star INTEGER,
  fake_star_json TEXT,
  lexicon INTEGER NOT NULL DEFAULT 0,
  dry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lab_event_pings_event ON lab_event_pings (event_id, first_seen_at);
CREATE INDEX IF NOT EXISTS lab_event_pings_source ON lab_event_pings (source, first_seen_at);
CREATE TABLE IF NOT EXISTS lab_event_coverage (
  event_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  is_owned INTEGER NOT NULL DEFAULT 0,
  posted_at TEXT NOT NULL,
  hours_since_t0 REAL NOT NULL,
  wave_n INTEGER NOT NULL DEFAULT 1,
  wave_position TEXT NOT NULL,
  creator_rank INTEGER,
  match_rule TEXT NOT NULL,
  confidence TEXT NOT NULL,
  confirmed INTEGER,
  angle TEXT NOT NULL DEFAULT 'other',
  angle_source TEXT NOT NULL DEFAULT 'rule',
  ratio REAL,
  ratio_age_h REAL,
  is_breakout INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (event_id, post_id)
);
CREATE INDEX IF NOT EXISTS lab_event_coverage_post ON lab_event_coverage (post_id);
CREATE TABLE IF NOT EXISTS lab_brief (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL UNIQUE,
  composed_at TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  dedupe_keys_json TEXT NOT NULL DEFAULT '[]',
  text TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  sent_via TEXT,
  send_error TEXT,
  dry INTEGER NOT NULL DEFAULT 0
);
-- 06 section 12
CREATE TABLE IF NOT EXISTS lab_predictions (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  predictor TEXT NOT NULL,
  predictor_version TEXT NOT NULL,
  kind TEXT NOT NULL,
  script_id TEXT,
  script_version INTEGER,
  post_id TEXT,
  source_id TEXT,
  platform TEXT,
  surface TEXT,
  ref_age_h REAL,
  as_of TEXT NOT NULL,
  frozen_at TEXT NOT NULL,
  backtest_origin TEXT,
  band TEXT,
  score REAL,
  ratio_point REAL, ratio_lo REAL, ratio_hi REAL,
  views_point REAL, views_lo REAL, views_hi REAL,
  p_breakout REAL,
  interval_level REAL,
  baseline_7d_views REAL,
  baseline_n INTEGER,
  inputs_json TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  payload_sha256 TEXT NOT NULL,
  late INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'frozen',
  void_reason TEXT,
  voided_at TEXT,
  outcome_views_7d REAL,
  outcome_ratio_7d REAL,
  outcome_band TEXT,
  outcome_is_breakout INTEGER,
  outcome_method TEXT,
  hit_band INTEGER,
  in_interval INTEGER,
  abs_log_err REAL,
  test_id TEXT,
  pair_right INTEGER,
  graded_at TEXT,
  dry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lab_predictions_post ON lab_predictions (post_id);
CREATE INDEX IF NOT EXISTS lab_predictions_pred ON lab_predictions (predictor, origin, status);
CREATE INDEX IF NOT EXISTS lab_predictions_origin ON lab_predictions (origin, backtest_origin);
CREATE UNIQUE INDEX IF NOT EXISTS lab_predictions_live_prepost ON lab_predictions (predictor, script_id)
  WHERE origin = 'live' AND kind = 'pre_post' AND script_id IS NOT NULL AND status <> 'void';
CREATE UNIQUE INDEX IF NOT EXISTS lab_predictions_live_prepost_post ON lab_predictions (predictor, post_id)
  WHERE origin = 'live' AND kind = 'pre_post' AND script_id IS NULL AND status <> 'void';
CREATE UNIQUE INDEX IF NOT EXISTS lab_predictions_live_early ON lab_predictions (predictor, post_id, ref_age_h)
  WHERE origin = 'live' AND kind = 'early' AND predictor <> 'comment_intent';
CREATE UNIQUE INDEX IF NOT EXISTS lab_predictions_live_ci ON lab_predictions (post_id)
  WHERE origin = 'live' AND predictor = 'comment_intent';
CREATE TABLE IF NOT EXISTS lab_evals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  predictor TEXT NOT NULL,
  predictor_version TEXT NOT NULL,
  scope TEXT NOT NULL,
  population TEXT NOT NULL,
  platform TEXT NOT NULL,
  window_weeks INTEGER NOT NULL,
  computed_date TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  harness_version TEXT NOT NULL,
  origins INTEGER NOT NULL DEFAULT 0,
  n_posts INTEGER NOT NULL DEFAULT 0,
  n_creators INTEGER NOT NULL DEFAULT 0,
  abstained INTEGER NOT NULL DEFAULT 0,
  n_pairs INTEGER NOT NULL DEFAULT 0,
  pairwise REAL, pairwise_lo REAL, pairwise_hi REAL,
  spearman REAL, spearman_lo REAL, spearman_hi REAL,
  log_mae REAL, log_mae_baseline REAL, mae_delta_lo REAL, mae_delta_hi REAL,
  coverage REAL, coverage_lo REAL, coverage_hi REAL, coverage_n INTEGER NOT NULL DEFAULT 0,
  pr_auc REAL, pr_auc_lo REAL, pr_auc_hi REAL, base_rate REAL, positives INTEGER NOT NULL DEFAULT 0,
  band_hits_json TEXT NOT NULL DEFAULT '{}',
  verdict_forecast TEXT, verdict_ranking TEXT, verdict_classifier TEXT,
  dry INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS lab_evals_key ON lab_evals (predictor, scope, population, platform, window_weeks, computed_date, dry);
CREATE TABLE IF NOT EXISTS lab_retention (
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  age_h REAL NOT NULL,
  partial INTEGER NOT NULL DEFAULT 0,
  curve_json TEXT,
  views INTEGER,
  avg_view_duration_s REAL,
  avg_view_pct REAL,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  saved INTEGER,
  shares INTEGER,
  total_interactions INTEGER,
  avg_watch_time_ms REAL,
  total_watch_time_ms REAL,
  skip_rate REAL,
  raw_json TEXT NOT NULL DEFAULT '{}',
  dry INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, captured_at)
);
CREATE INDEX IF NOT EXISTS lab_retention_post ON lab_retention (post_id, age_h);
CREATE TABLE IF NOT EXISTS lab_tests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL DEFAULT '',
  variable TEXT NOT NULL,
  feature_key TEXT,
  expected_sign INTEGER,
  script_id TEXT,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  arms_json TEXT NOT NULL DEFAULT '[]',
  judge_age_h REAL,
  primary_metric TEXT NOT NULL,
  result TEXT,
  winner_arm TEXT,
  observed_sign INTEGER,
  confirms INTEGER,
  judge_detail_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  plan_week TEXT,
  started_at TEXT,
  judged_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  dry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lab_tests_kind ON lab_tests (kind, status);
CREATE INDEX IF NOT EXISTS lab_tests_feature ON lab_tests (feature_key);
-- 07 7.11, 7.13.3
CREATE TABLE IF NOT EXISTS lab_embeddings (
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  text_hash TEXT NOT NULL,
  vec BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (subject_kind, subject_id, model)
);
CREATE INDEX IF NOT EXISTS lab_embeddings_kind_model ON lab_embeddings (subject_kind, model);
CREATE TABLE IF NOT EXISTS lab_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  author_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  likes INTEGER,
  replies INTEGER,
  is_reply INTEGER NOT NULL DEFAULT 0,
  by_creator INTEGER NOT NULL DEFAULT 0,
  creator_heart INTEGER,
  posted_at TEXT,
  captured_at TEXT NOT NULL,
  intent TEXT NOT NULL,
  intent_rule TEXT,
  run_id TEXT
);
CREATE INDEX IF NOT EXISTS lab_comments_post ON lab_comments (post_id);
CREATE INDEX IF NOT EXISTS lab_comments_author ON lab_comments (author_hash);
-- 09 09.6
CREATE TABLE IF NOT EXISTS lab_forecasts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  frozen_at TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  predicted REAL NOT NULL,
  lo REAL, hi REAL,
  expected_items INTEGER,
  actual REAL,
  actual_items INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  graded_at TEXT,
  dry INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lab_forecasts_kind ON lab_forecasts (kind, frozen_at);
CREATE INDEX IF NOT EXISTS lab_forecasts_subject ON lab_forecasts (subject);
`;

/** 06 2.4(b): a live prediction's frozen fields, post link and grade are written once; live non-dry rows are never deleted. Applied after the tables (part of LAB_DDL). */
export const LEDGER_TRIGGERS_DDL = `
CREATE TRIGGER IF NOT EXISTS lab_predictions_frozen_cols
BEFORE UPDATE OF id, origin, predictor, predictor_version, kind, script_id, script_version, source_id, platform, surface,
  ref_age_h, as_of, frozen_at, backtest_origin, band, score, ratio_point, ratio_lo, ratio_hi, views_point,
  views_lo, views_hi, p_breakout, interval_level, baseline_7d_views, baseline_n, inputs_json, note, payload_sha256
ON lab_predictions WHEN OLD.origin = 'live'
BEGIN SELECT RAISE(ABORT, 'lab_predictions: frozen fields are immutable'); END;
CREATE TRIGGER IF NOT EXISTS lab_predictions_post_once
BEFORE UPDATE OF post_id, late ON lab_predictions
WHEN OLD.origin = 'live' AND OLD.post_id IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'lab_predictions: post link is set once'); END;
CREATE TRIGGER IF NOT EXISTS lab_predictions_grade_once
BEFORE UPDATE OF outcome_views_7d, outcome_ratio_7d, outcome_band, outcome_is_breakout, outcome_method,
  hit_band, in_interval, abs_log_err, test_id, pair_right, graded_at
ON lab_predictions WHEN OLD.origin = 'live' AND OLD.graded_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'lab_predictions: a grade is written once'); END;
CREATE TRIGGER IF NOT EXISTS lab_predictions_status_flow
BEFORE UPDATE OF status ON lab_predictions
WHEN OLD.origin = 'live' AND NOT (
  (OLD.status = 'frozen' AND NEW.status IN ('frozen','graded','ungradable','void')) OR
  (OLD.status IN ('graded','ungradable') AND NEW.status IN (OLD.status,'void')) OR
  (OLD.status = 'void' AND NEW.status = 'void'))
BEGIN SELECT RAISE(ABORT, 'lab_predictions: illegal status change'); END;
CREATE TRIGGER IF NOT EXISTS lab_predictions_no_delete
BEFORE DELETE ON lab_predictions WHEN OLD.origin = 'live' AND OLD.dry = 0
BEGIN SELECT RAISE(ABORT, 'lab_predictions: live predictions are never deleted'); END;
`;

/** 09.6 lab_forecasts_lock: no UPDATE once a row is graded or void; a late row may be updated once, to graded. */
export const LAB_FORECASTS_TRIGGER_DDL = `
CREATE TRIGGER IF NOT EXISTS lab_forecasts_lock
BEFORE UPDATE ON lab_forecasts
WHEN OLD.status IN ('graded','void') OR (OLD.status = 'late' AND NEW.status <> 'graded')
BEGIN SELECT RAISE(ABORT, 'lab_forecasts: a graded forecast is immutable'); END;
`;
/* ── end Content Lab v2 tables ── */

export const LAB_DDL = `
CREATE TABLE IF NOT EXISTS lab_sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  url TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  added_at TEXT NOT NULL,
  reason TEXT,
  score REAL
);
CREATE UNIQUE INDEX IF NOT EXISTS lab_sources_handle ON lab_sources (platform, handle);
CREATE TABLE IF NOT EXISTS lab_creator_snapshots (
  source_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  followers INTEGER,
  following INTEGER,
  post_count INTEGER
);
CREATE INDEX IF NOT EXISTS lab_creator_snapshots_source ON lab_creator_snapshots (source_id, captured_at);
CREATE TABLE IF NOT EXISTS lab_posts (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  posted_at TEXT,
  caption TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'video',
  thumbnail_url TEXT,
  media_url TEXT,
  duration_s REAL,
  is_owned INTEGER NOT NULL DEFAULT 0,
  UNIQUE (platform, external_id)
);
CREATE INDEX IF NOT EXISTS lab_posts_source ON lab_posts (source_id, posted_at);
CREATE TABLE IF NOT EXISTS lab_post_metrics (
  post_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER
);
CREATE INDEX IF NOT EXISTS lab_post_metrics_post ON lab_post_metrics (post_id, captured_at);
CREATE TABLE IF NOT EXISTS lab_transcripts (
  post_id TEXT PRIMARY KEY,
  text TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  wpm REAL,
  provider TEXT NOT NULL DEFAULT '',
  cost_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'none'
);
CREATE TABLE IF NOT EXISTS lab_dissections (
  post_id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  hook_form TEXT NOT NULL,
  emotional_trigger TEXT NOT NULL,
  hook_channel TEXT NOT NULL,
  hook_text TEXT NOT NULL DEFAULT '',
  first_frame_text TEXT NOT NULL DEFAULT '',
  structure_type TEXT NOT NULL,
  beats_json TEXT NOT NULL DEFAULT '[]',
  pacing TEXT NOT NULL,
  pillar TEXT NOT NULL,
  cta_type TEXT NOT NULL,
  tension_json TEXT,
  confidences_json TEXT NOT NULL DEFAULT '{}',
  quality_notes TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  analysed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_post_topics (
  post_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT '',
  is_primary INTEGER NOT NULL DEFAULT 0,
  cluster_id TEXT,
  embedding BLOB
);
CREATE INDEX IF NOT EXISTS lab_post_topics_post ON lab_post_topics (post_id);
CREATE INDEX IF NOT EXISTS lab_post_topics_cluster ON lab_post_topics (cluster_id);
CREATE TABLE IF NOT EXISTS lab_measures (
  post_id TEXT PRIMARY KEY,
  depth REAL,
  breakout REAL,
  breakout_lo REAL,
  breakout_hi REAL,
  baseline_n INTEGER NOT NULL DEFAULT 0,
  baseline_confidence TEXT NOT NULL DEFAULT 'low',
  reach REAL,
  velocity REAL,
  trajectory TEXT,
  quadrant TEXT,
  is_breakout INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_clusters (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  centroid BLOB,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_trend_snapshots (
  cluster_id TEXT NOT NULL,
  day TEXT NOT NULL,
  posts INTEGER NOT NULL DEFAULT 0,
  breakouts INTEGER NOT NULL DEFAULT 0,
  creators INTEGER NOT NULL DEFAULT 0,
  platforms INTEGER NOT NULL DEFAULT 0,
  feed_mentions INTEGER NOT NULL DEFAULT 0,
  source_count INTEGER NOT NULL DEFAULT 0,
  momentum REAL,
  timing TEXT,
  PRIMARY KEY (cluster_id, day)
);
CREATE TABLE IF NOT EXISTS lab_trend_items (
  id TEXT PRIMARY KEY,
  feed TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  score REAL,
  comments INTEGER,
  sources_json TEXT NOT NULL DEFAULT '[]',
  source_count INTEGER NOT NULL DEFAULT 1,
  cluster_id TEXT,
  seen_at TEXT NOT NULL,
  acted_on_at TEXT
);
CREATE TABLE IF NOT EXISTS lab_profiles (
  id TEXT PRIMARY KEY,
  format_family TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 90,
  posts_n INTEGER NOT NULL DEFAULT 0,
  breakouts_n INTEGER NOT NULL DEFAULT 0,
  features_json TEXT NOT NULL DEFAULT '[]',
  strand_json TEXT NOT NULL DEFAULT '[]',
  stats_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lab_profiles_family ON lab_profiles (format_family, version);
CREATE TABLE IF NOT EXISTS lab_ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  cluster_id TEXT,
  angle TEXT NOT NULL DEFAULT '',
  tension_json TEXT,
  format_family TEXT NOT NULL,
  strand_json TEXT NOT NULL DEFAULT '[]',
  hook_recs_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  timing TEXT,
  fit REAL NOT NULL DEFAULT 0,
  thin INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  dismiss_reason TEXT,
  created_at TEXT NOT NULL,
  acted_on_at TEXT
);
CREATE TABLE IF NOT EXISTS lab_scripts (
  id TEXT PRIMARY KEY,
  idea_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  published_post_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_script_versions (
  script_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  gate_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  edit_diff TEXT,
  PRIMARY KEY (script_id, version)
);
CREATE TABLE IF NOT EXISTS lab_outcomes (
  script_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  breakout REAL,
  depth REAL
);
CREATE TABLE IF NOT EXISTS lab_priors (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  supersedes_default INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  apify_run_id TEXT,
  dataset_id TEXT,
  actor TEXT,
  input_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  items INTEGER,
  cost_usd REAL,
  dry INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS lab_runs_started ON lab_runs (started_at);
CREATE TABLE IF NOT EXISTS lab_spend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT,
  provider TEXT NOT NULL,
  units REAL NOT NULL DEFAULT 0,
  est_usd REAL,
  actual_usd REAL,
  dry INTEGER NOT NULL DEFAULT 0,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lab_spend_at ON lab_spend (provider, at);
${LAB_V2_DDL}${LEDGER_TRIGGERS_DDL}${LAB_FORECASTS_TRIGGER_DDL}`;
/* ── end Content Lab tables ── */

/* ── Content Lab v2 migration (S0; 08.11.2). The ONLY migrateLabV2 and the ONLY place a
   v1 lab table gains a column. A section that needs another column adds a row here. ── */

/** Raised when a schema change ships; lab_meta_version() must equal it (health `db.schema`). */
export const LAB_SCHEMA_VERSION = 2;

/** Every column v2 adds to a v1 lab table, one list for all sections (owner = spec section). */
export const LAB_V2_COLUMNS: { table: string; column: string; ddl: string; owner: '04' | '05' | '07' | '08' | '09' }[] = [
  // 04 section 8
  { table: 'lab_post_metrics', column: 'age_h', ddl: 'REAL', owner: '04' },
  { table: 'lab_post_metrics', column: 'target_age_h', ddl: 'REAL', owner: '04' },
  { table: 'lab_post_metrics', column: 'read_kind', ddl: "TEXT NOT NULL DEFAULT 'cycle'", owner: '04' },
  { table: 'lab_post_metrics', column: 'quotes', ddl: 'INTEGER', owner: '04' },
  { table: 'lab_posts', column: 'epoch', ddl: "TEXT NOT NULL DEFAULT 'current'", owner: '04' },
  { table: 'lab_posts', column: 'exo_reason', ddl: 'TEXT', owner: '04' },
  { table: 'lab_posts', column: 'exo_note', ddl: 'TEXT', owner: '04' },
  { table: 'lab_posts', column: 'exo_at', ddl: 'TEXT', owner: '04' },
  { table: 'lab_measures', column: 'measure_version', ddl: "TEXT NOT NULL DEFAULT 'measure-v1'", owner: '04' },
  { table: 'lab_measures', column: 'metric_basis', ddl: "TEXT NOT NULL DEFAULT 'views'", owner: '04' },
  { table: 'lab_measures', column: 'judged_age_h', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'basis_at_age', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'baseline_log', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'baseline_var', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'prior_log', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'shrink_b', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'baseline_source', ddl: 'TEXT', owner: '04' },
  { table: 'lab_measures', column: 'robust_z', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'volatility', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'volatility_class', ddl: 'TEXT', owner: '04' },
  { table: 'lab_measures', column: 'max_over_median', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'niche_ratio', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'dual_high', ddl: 'INTEGER NOT NULL DEFAULT 0', owner: '04' },
  { table: 'lab_measures', column: 'trajectory_class', ddl: 'TEXT', owner: '04' },
  { table: 'lab_measures', column: 'peak_day_share', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'exo_auto', ddl: 'INTEGER NOT NULL DEFAULT 0', owner: '04' },
  { table: 'lab_measures', column: 'shares_per_view', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'saves_per_view', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'x_action_score', ddl: 'REAL', owner: '04' },
  { table: 'lab_measures', column: 'followers_as_of', ddl: 'TEXT', owner: '04' },
  { table: 'lab_measures', column: 'ages_json', ddl: "TEXT NOT NULL DEFAULT '{}'", owner: '04' },
  { table: 'lab_profiles', column: 'method', ddl: "TEXT NOT NULL DEFAULT 'lift_wilson_v1'", owner: '04' },
  { table: 'lab_profiles', column: 'controls_n', ddl: 'INTEGER NOT NULL DEFAULT 0', owner: '04' },
  { table: 'lab_profiles', column: 'fdr_q', ddl: 'REAL', owner: '04' },
  // 05 section 16
  { table: 'lab_ideas', column: 'event_id', ddl: 'TEXT', owner: '05' },
  { table: 'lab_ideas', column: 'launch_angle', ddl: 'TEXT', owner: '05' },
  // 07 7.3.6, 7.14.4
  { table: 'lab_ideas', column: 'source', ddl: "TEXT NOT NULL DEFAULT 'sync'", owner: '07' },
  { table: 'lab_ideas', column: 'batch_id', ddl: 'TEXT', owner: '07' },
  { table: 'lab_ideas', column: 'seed_id', ddl: 'TEXT', owner: '07' },
  { table: 'lab_ideas', column: 'notes', ddl: 'TEXT', owner: '07' },
  { table: 'lab_ideas', column: 'hook_form', ddl: 'TEXT', owner: '07' },
  { table: 'lab_ideas', column: 'hook_trigger', ddl: 'TEXT', owner: '07' },
  { table: 'lab_ideas', column: 'vs_probability', ddl: 'REAL', owner: '07' },
  { table: 'lab_ideas', column: 'mmr_rank', ddl: 'INTEGER', owner: '07' },
  { table: 'lab_ideas', column: 'grounding_json', ddl: "TEXT NOT NULL DEFAULT '{}'", owner: '07' },
  { table: 'lab_ideas', column: 'prompt_version', ddl: 'TEXT', owner: '07' },
  { table: 'lab_dissections', column: 'frames_used', ddl: 'INTEGER NOT NULL DEFAULT 0', owner: '07' },
  { table: 'lab_dissections', column: 'on_screen_text_density', ddl: 'INTEGER', owner: '07' },
  { table: 'lab_dissections', column: 'face_first_frame', ddl: 'INTEGER', owner: '07' },
  { table: 'lab_dissections', column: 'sheet_path', ddl: 'TEXT', owner: '07' },
  // 08.6.4
  { table: 'lab_spend', column: 'line', ddl: 'TEXT', owner: '08' },
  { table: 'lab_spend', column: 'reserved_usd', ddl: 'REAL', owner: '08' },
  { table: 'lab_spend', column: 'actual_source', ddl: 'TEXT', owner: '08' },
  { table: 'lab_spend', column: 'events_json', ddl: 'TEXT', owner: '08' },
  { table: 'lab_spend', column: 'settled_at', ddl: 'TEXT', owner: '08' },
  { table: 'lab_runs', column: 'line', ddl: 'TEXT', owner: '08' },
  { table: 'lab_runs', column: 'job', ddl: 'TEXT', owner: '08' },
  { table: 'lab_runs', column: 'scheduled', ddl: 'INTEGER NOT NULL DEFAULT 0', owner: '08' },
  // 09 09.6
  { table: 'lab_runs', column: 'batch_id', ddl: 'TEXT', owner: '09' },
  { table: 'lab_runs', column: 'progress_json', ddl: 'TEXT', owner: '09' },
];

/** Indexes on LAB_V2_COLUMNS columns: created after the column exists, so not in LAB_DDL. */
export const LAB_V2_INDEXES = [
  'CREATE INDEX IF NOT EXISTS lab_post_metrics_age ON lab_post_metrics (post_id, age_h)', // 04
  'CREATE INDEX IF NOT EXISTS lab_ideas_batch ON lab_ideas (batch_id)', // 07
  'CREATE INDEX IF NOT EXISTS lab_runs_batch ON lab_runs (batch_id)', // 09
] as const;

/** The prior `schema_version` ({ v }); absent = 1 (a v1 database never migrated). */
export function lab_meta_version(db: InstanceType<typeof Database>): number {
  const row = db.prepare("SELECT value_json FROM lab_priors WHERE key = 'schema_version'").get() as { value_json: string } | undefined;
  if (!row) return 1;
  try {
    const v = Number((JSON.parse(row.value_json) as { v?: unknown }).v);
    return Number.isFinite(v) ? v : 1;
  } catch {
    return 1;
  }
}

/**
 * The one v1 to v2 migration (08.11.2). Idempotent: every ADD COLUMN is guarded by
 * PRAGMA table_info, every backfill only touches rows still missing the value, and a second
 * run changes nothing. Needs LAB_DDL applied first (getDb, the sample world and labStore()
 * all do). Nothing is deleted. Ends by writing prior `schema_version` { v: LAB_SCHEMA_VERSION }.
 */
export function migrateLabV2(db: InstanceType<typeof Database>): void {
  const has = new Map<string, Set<string>>();
  const cols = (table: string) => {
    let set = has.get(table);
    if (!set) {
      set = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
      has.set(table, set);
    }
    return set;
  };
  if (LAB_V2_COLUMNS.every((c) => cols(c.table).has(c.column)) && lab_meta_version(db) >= LAB_SCHEMA_VERSION) return;
  // IMMEDIATE takes the write lock first and the columns are re-read under it: `next build` runs
  // several prerender workers on one database, and a check made outside the lock let two of them
  // ALTER the same column ("duplicate column name: age_h").
  db.transaction(() => {
    has.clear();
    const missing = LAB_V2_COLUMNS.filter((c) => !cols(c.table).has(c.column));
    const versionNow = lab_meta_version(db);
    if (missing.length === 0 && versionNow >= LAB_SCHEMA_VERSION) return;
    for (const c of missing) {
      db.exec(`ALTER TABLE ${c.table} ADD COLUMN ${c.column} ${c.ddl}`);
      cols(c.table).add(c.column);
    }
    for (const sql of LAB_V2_INDEXES) db.exec(sql);
    // 04: ages of existing reads (only when the column was just added; negative ages stay null)
    if (missing.some((c) => c.table === 'lab_post_metrics' && c.column === 'age_h')) {
      db.exec(`UPDATE lab_post_metrics SET age_h = (
          SELECT (julianday(lab_post_metrics.captured_at) - julianday(p.posted_at)) * 24 FROM lab_posts p
          WHERE p.id = lab_post_metrics.post_id AND p.posted_at IS NOT NULL
            AND julianday(lab_post_metrics.captured_at) >= julianday(p.posted_at))
        WHERE age_h IS NULL`);
    }
    // 08.6.4: v1 spend rows were all sync work on Apify
    db.exec("UPDATE lab_spend SET line = CASE provider WHEN 'apify' THEN 'apify.sync' ELSE provider END WHERE line IS NULL");
    db.exec("UPDATE lab_spend SET actual_source = 'dry' WHERE dry = 1 AND actual_source IS NULL");
    db.exec("UPDATE lab_spend SET actual_source = 'provider', settled_at = at WHERE dry = 0 AND actual_usd IS NOT NULL AND actual_source IS NULL");
    if (versionNow < LAB_SCHEMA_VERSION) {
      db.prepare('INSERT OR REPLACE INTO lab_priors (key, value_json, n, supersedes_default, updated_at) VALUES (?, ?, 0, 0, ?)')
        .run('schema_version', JSON.stringify({ v: LAB_SCHEMA_VERSION }), new Date().toISOString());
    }
  }).immediate();
}
/* ── end Content Lab v2 migration ── */
