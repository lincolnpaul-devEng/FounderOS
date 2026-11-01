import type Database from 'better-sqlite3';

/** Shared reconcile helper for seed-driven lists (departments, agents, people,
 * sop_tasks, workflows, skills): delete every row whose id is NOT in the keep
 * list, then the seed inserts the surviving rows back with upserts. An empty
 * keep-list means "remove everything": SQL rejects `NOT IN ()`, so that case
 * is a plain DELETE. */
export function deleteNotIn(db: InstanceType<typeof Database>, table: string, ids: readonly string[]): void {
  if (ids.length === 0) { db.prepare(`DELETE FROM "${table}"`).run(); return; }
  const placeholders = ids.map(() => '?').join(', ');
  db.prepare(`DELETE FROM "${table}" WHERE id NOT IN (${placeholders})`).run(...ids);
}
