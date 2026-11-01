import type Database from 'better-sqlite3';
import {
  WorkflowSchema, type Workflow,
  WorkflowVersionSchema, type WorkflowVersion,
  ConfigVersionSchema, type ConfigVersion,
} from '@/lib/schemas';
import { deleteNotIn } from '../ops';

/** Version tables for workflow + config edits (immutable, newest first). */
export function workflowRepos(db: InstanceType<typeof Database>) {
  const rowToWorkflow = (r: any): Workflow =>
    WorkflowSchema.parse({
      id: r.id,
      name: r.name,
      subtitle: r.subtitle,
      revenueUsd: r.revenue_usd,
      order: r.ord,
      steps: JSON.parse(r.steps),
      // only present when set, so rows written before the canvas read back
      // exactly as they were written
      ...(r.ratio_target != null ? { ratioTarget: r.ratio_target } : {}),
    });

  const rowToWorkflowVersion = (r: any): WorkflowVersion =>
    WorkflowVersionSchema.parse({ id: r.id, workflowId: r.workflow_id, version: r.version, createdAt: r.created_at, note: r.note, snapshot: JSON.parse(r.snapshot) });
  const workflowVersions = {
    list(workflowId: string): WorkflowVersion[] {
      return db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC').all(workflowId).map(rowToWorkflowVersion);
    },
    get(id: string): WorkflowVersion | null {
      const r = db.prepare('SELECT * FROM workflow_versions WHERE id = ?').get(id) as any;
      return r ? rowToWorkflowVersion(r) : null;
    },
    latest(workflowId: string): WorkflowVersion | null {
      const r = db.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC LIMIT 1').get(workflowId) as any;
      return r ? rowToWorkflowVersion(r) : null;
    },
    /** Appends a version unless the snapshot equals the latest one. */
    record(w: Workflow, note = ''): WorkflowVersion | null {
      const snapshot = JSON.stringify(w);
      const last = workflowVersions.latest(w.id);
      if (last && JSON.stringify(last.snapshot) === snapshot) return null;
      const version = (last?.version ?? 0) + 1;
      const id = `${w.id}-v${version}`;
      const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO workflow_versions (id, workflow_id, version, created_at, note, snapshot) VALUES (?, ?, ?, ?, ?, ?)').run(id, w.id, version, createdAt, note, snapshot);
      return { id, workflowId: w.id, version, createdAt, note, snapshot: JSON.parse(snapshot) };
    },
  };

  const rowToConfigVersion = (r: any): ConfigVersion =>
    ConfigVersionSchema.parse({ id: r.id, target: r.target, version: r.version, createdAt: r.created_at, note: r.note, snapshot: JSON.parse(r.snapshot) });
  const configVersions = {
    list(target: string): ConfigVersion[] {
      return db.prepare('SELECT * FROM config_versions WHERE target = ? ORDER BY version DESC').all(target).map(rowToConfigVersion);
    },
    get(id: string): ConfigVersion | null {
      const r = db.prepare('SELECT * FROM config_versions WHERE id = ?').get(id) as any;
      return r ? rowToConfigVersion(r) : null;
    },
    latest(target: string): ConfigVersion | null {
      const r = db.prepare('SELECT * FROM config_versions WHERE target = ? ORDER BY version DESC LIMIT 1').get(target) as any;
      return r ? rowToConfigVersion(r) : null;
    },
    /** Appends a version unless identical to the latest. */
    record(target: string, snapshotValue: unknown, note = ''): ConfigVersion {
      const snapshot = JSON.stringify(snapshotValue);
      const last = configVersions.latest(target);
      if (last && JSON.stringify(last.snapshot) === snapshot) return last;
      const version = (last?.version ?? 0) + 1;
      const id = `${target}-v${version}`;
      const createdAt = new Date().toISOString();
      db.prepare('INSERT INTO config_versions (id, target, version, created_at, note, snapshot) VALUES (?, ?, ?, ?, ?, ?)').run(id, target, version, createdAt, note, snapshot);
      return { id, target, version, createdAt, note, snapshot: JSON.parse(snapshot) };
    },
  };

  const workflows = {
    all(): Workflow[] {
      return db.prepare('SELECT * FROM workflows ORDER BY ord, name').all().map(rowToWorkflow);
    },
    /** Single workflow by id, or null when it doesn't exist — the builder's
     *  update/delete routes use this to tell "not found" from a real 500. */
    get(id: string): Workflow | null {
      const r = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as any;
      return r ? rowToWorkflow(r) : null;
    },
    /** Create-or-replace, and the ONLY write path — so every save records a
     *  version (skipped when nothing changed, so re-running the seed does not
     *  pile up identical rows). `note` labels the version. */
    insert(w: Workflow, note = ''): void {
      WorkflowSchema.parse(w);
      db.prepare(
        'INSERT OR REPLACE INTO workflows (id, name, subtitle, revenue_usd, ord, steps, ratio_target) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(w.id, w.name, w.subtitle, w.revenueUsd, w.order, JSON.stringify(w.steps), w.ratioTarget ?? null);
      workflowVersions.record(w, note);
    },
    /** Deletes one workflow by id — the builder's delete affordance. Distinct
     *  from `deleteWhereIdNotIn`, which is the seed's bulk reconciliation. */
    remove(id: string): void {
      db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      deleteNotIn(db, 'workflows', ids);
    },
  };

  return { workflows, workflowVersions, configVersions };
}
