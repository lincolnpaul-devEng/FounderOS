import type Database from 'better-sqlite3';

/** Databases created before the hierarchy build lack these columns. */
export function migrateAgentsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(agents)') as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('parent_id')) db.exec('ALTER TABLE agents ADD COLUMN parent_id TEXT');
  if (!columns.has('instance')) db.exec("ALTER TABLE agents ADD COLUMN instance TEXT NOT NULL DEFAULT 'builtin'");
}

/** Databases created before the funnel-space build lack these columns. */
/** 2026-09-15: the canvas stores a target agent-owned ratio per workflow. */
export function migrateWorkflowsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set((db.prepare('PRAGMA table_info(workflows)').all() as { name: string }[]).map((c) => c.name));
  if (!columns.has('ratio_target')) db.exec('ALTER TABLE workflows ADD COLUMN ratio_target REAL');
}

export function migrateFunnelContactsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(funnel_contacts)') as { name: string }[]).map((c) => c.name),
  );
  if (!columns.has('relationship')) db.exec("ALTER TABLE funnel_contacts ADD COLUMN relationship TEXT NOT NULL DEFAULT 'warm'");
  if (!columns.has('likelihood')) db.exec('ALTER TABLE funnel_contacts ADD COLUMN likelihood INTEGER NOT NULL DEFAULT 50');
  if (!columns.has('email')) db.exec('ALTER TABLE funnel_contacts ADD COLUMN email TEXT');
  if (!columns.has('phone')) db.exec('ALTER TABLE funnel_contacts ADD COLUMN phone TEXT');
  // dossier identity (Round 15) — the human behind the deal
  for (const col of ['person', 'company', 'role', 'linkedin']) {
    if (!columns.has(col)) db.exec(`ALTER TABLE funnel_contacts ADD COLUMN ${col} TEXT`);
  }
}

/**
 * The tasks overhaul (docs/TASKS-REDESIGN.md) gave a task a body, a due date,
 * a priority, an owner lane and a horizon. Databases created before it have
 * none of them; every column carries a default so existing rows stay valid.
 * `agent_id` was NOT NULL and cannot be widened in place, so operator-owned
 * tasks on an old database write the sentinel '' and read back as null.
 */
export function migrateAgentTasksTable(db: InstanceType<typeof Database>): void {
  const columns = new Set(
    (db.pragma('table_info(agent_tasks)') as { name: string }[]).map((c) => c.name),
  );
  if (columns.size === 0) return;
  if (!columns.has('detail')) db.exec("ALTER TABLE agent_tasks ADD COLUMN detail TEXT NOT NULL DEFAULT ''");
  if (!columns.has('due_at')) db.exec('ALTER TABLE agent_tasks ADD COLUMN due_at TEXT');
  if (!columns.has('priority')) db.exec("ALTER TABLE agent_tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");
  if (!columns.has('owner_kind')) db.exec("ALTER TABLE agent_tasks ADD COLUMN owner_kind TEXT NOT NULL DEFAULT 'agent'");
  if (!columns.has('horizon')) db.exec('ALTER TABLE agent_tasks ADD COLUMN horizon TEXT');
  if (!columns.has('run_id')) db.exec('ALTER TABLE agent_tasks ADD COLUMN run_id TEXT');
}

// Skills gained a `markdown` (SKILL.md) column after first ship. Add it, and
// clear the stale rows so the re-seed backfills each skill's doc.
export function migrateSkillsTable(db: InstanceType<typeof Database>): void {
  const columns = new Set((db.pragma('table_info(skills)') as { name: string }[]).map((c) => c.name));
  if (columns.size > 0 && !columns.has('markdown')) {
    db.exec("ALTER TABLE skills ADD COLUMN markdown TEXT NOT NULL DEFAULT ''");
    db.exec('DELETE FROM skills');
  }
}
