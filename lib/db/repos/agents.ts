import type Database from 'better-sqlite3';
import {
  AgentSchema, type Agent,
  AgentRunSchema, type AgentRun,
  AgentMessageSchema, type AgentMessage,
  BroadcastSchema, type Broadcast,
  BroadcastReplySchema, type BroadcastReply,
  AgentTaskSchema, AgentTaskStatusSchema, type AgentTask,
  AgentCronSchema, type AgentCron,
  ContactTagSchema, type ContactTag,
} from '@/lib/schemas';
import type { AgentTaskInput } from '@/lib/schemas';
import { deleteNotIn } from '../ops';
import { isValidCron } from '@/lib/cron';

/**
 * The agent and its activity: rows, run logs, chat messages, broadcast
 * replies, task cards, scheduled crons and contact tags.
 */

type AgentRow = {
  id: string;
  department_id: string;
  name: string;
  role: string;
  status: string;
  tier: string;
  description: string;
  model: string;
  tools: string;
  parent_id: string | null;
  instance: string;
};

function rowToAgent(row: AgentRow): Agent {
  return AgentSchema.parse({
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    role: row.role,
    status: row.status,
    tier: row.tier,
    description: row.description,
    model: row.model,
    tools: JSON.parse(row.tools),
    parentId: row.parent_id,
    instance: row.instance,
  });
}

/** Repos over activity tables; spread into the single store by lib/db (openDb). */
export function agentRepos(db: InstanceType<typeof Database>) {

  const agents = {
    all(): Agent[] {
      return (db.prepare('SELECT * FROM agents ORDER BY tier, name').all() as AgentRow[]).map(rowToAgent);
    },
    byDepartment(departmentId: string): Agent[] {
      return (
        db
          .prepare('SELECT * FROM agents WHERE department_id = ? ORDER BY tier, name')
          .all(departmentId) as AgentRow[]
      ).map(rowToAgent);
    },
    get(id: string): Agent | null {
      const r = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
      return r ? rowToAgent(r) : null;
    },
    /** Failover (F9): move a stored agent onto another model. False when the id is unknown. */
    setModel(id: string, model: string): boolean {
      return db.prepare('UPDATE agents SET model = ? WHERE id = ?').run(model, id).changes > 0;
    },
    insert(a: Agent): void {
      db.prepare(
        'INSERT OR REPLACE INTO agents (id, department_id, name, role, status, tier, description, model, tools, parent_id, instance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        a.id, a.departmentId, a.name, a.role, a.status, a.tier, a.description, a.model,
        JSON.stringify(a.tools), a.parentId, a.instance,
      );
    },
    deleteWhereIdNotIn(ids: string[]): void {
      deleteNotIn(db, 'agents', ids);
    },
  };

  const rowToRun = (r: any): AgentRun =>
    AgentRunSchema.parse({
      id: r.id,
      agentId: r.agent_id,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      ok: Boolean(r.ok),
      summary: r.summary,
    });

  const agentRuns = {
    byAgent(agentId: string): AgentRun[] {
      return db
        .prepare('SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY started_at DESC')
        .all(agentId)
        .map(rowToRun);
    },
    get(id: string): AgentRun | null {
      const r = db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(id);
      return r ? rowToRun(r) : null;
    },
    recent(limit: number): AgentRun[] {
      return db
        .prepare('SELECT * FROM agent_runs ORDER BY started_at DESC, rowid DESC LIMIT ?')
        .all(limit)
        .map(rowToRun);
    },
    /** Lifetime run count, uncapped (SPEC C20): not `recent(n).length`, which stops at n. */
    count(): number {
      return (db.prepare('SELECT COUNT(*) AS n FROM agent_runs').get() as { n: number }).n;
    },
    /** The newest run (same order as `recent`), or null on an install with none. Feeds "last run N ago". */
    latest(): AgentRun | null {
      const r = db.prepare('SELECT * FROM agent_runs ORDER BY started_at DESC, rowid DESC LIMIT 1').get();
      return r ? rowToRun(r) : null;
    },
    insert(run: AgentRun): void {
      db.prepare(
        'INSERT OR REPLACE INTO agent_runs (id, agent_id, started_at, finished_at, ok, summary) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(run.id, run.agentId, run.startedAt, run.finishedAt, run.ok ? 1 : 0, run.summary);
    },
  };

  const rowToMessage = (r: any): AgentMessage =>
    AgentMessageSchema.parse({
      id: r.id,
      agentId: r.agent_id,
      role: r.role,
      content: r.content,
      toolCalls: JSON.parse(r.tool_calls || '[]'),
      createdAt: r.created_at,
    });

  const agentMessages = {
    insert(m: AgentMessage): void {
      const parsed = AgentMessageSchema.parse(m);
      db.prepare(
        'INSERT OR REPLACE INTO agent_messages (id, agent_id, role, content, tool_calls, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(parsed.id, parsed.agentId, parsed.role, parsed.content, JSON.stringify(parsed.toolCalls), parsed.createdAt);
    },
    /** Full conversation for one agent, oldest → newest (ready to replay). */
    byAgent(agentId: string): AgentMessage[] {
      return db
        .prepare('SELECT * FROM agent_messages WHERE agent_id = ? ORDER BY created_at ASC, rowid ASC')
        .all(agentId)
        .map(rowToMessage);
    },
    recent(limit: number): AgentMessage[] {
      return db
        .prepare('SELECT * FROM agent_messages ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(limit)
        .map(rowToMessage);
    },
  };

  const rowToReply = (r: any): BroadcastReply =>
    BroadcastReplySchema.parse({
      id: r.id,
      broadcastId: r.broadcast_id,
      agentId: r.agent_id,
      ok: Boolean(r.ok),
      reply: r.reply,
      finishedAt: r.finished_at,
    });

  const broadcasts = {
    insert(b: { id: string; message: string; createdAt: string }): void {
      db.prepare('INSERT OR REPLACE INTO broadcasts (id, message, created_at) VALUES (?, ?, ?)').run(
        b.id, b.message, b.createdAt,
      );
    },
    insertReply(r: BroadcastReply): void {
      db.prepare(
        'INSERT OR REPLACE INTO broadcast_replies (id, broadcast_id, agent_id, ok, reply, finished_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(r.id, r.broadcastId, r.agentId, r.ok ? 1 : 0, r.reply, r.finishedAt);
    },
    recent(limit: number): Broadcast[] {
      const rows = db
        .prepare('SELECT * FROM broadcasts ORDER BY created_at DESC, rowid DESC LIMIT ?')
        .all(limit) as { id: string; message: string; created_at: string }[];
      const replyStmt = db.prepare('SELECT * FROM broadcast_replies WHERE broadcast_id = ? ORDER BY agent_id');
      return rows.map((b) =>
        BroadcastSchema.parse({
          id: b.id,
          message: b.message,
          createdAt: b.created_at,
          replies: replyStmt.all(b.id).map(rowToReply),
        }),
      );
    },
  };

  const rowToTask = (r: any): AgentTask =>
    AgentTaskSchema.parse({
      id: r.id,
      // '' is the old NOT NULL schema's stand-in for "no agent" (see the migration)
      agentId: r.agent_id ? r.agent_id : null,
      title: r.title, status: r.status,
      createdAt: r.created_at, updatedAt: r.updated_at,
      detail: r.detail ?? '',
      dueAt: r.due_at ?? null,
      priority: r.priority ?? 'normal',
      ownerKind: r.owner_kind ?? 'agent',
      horizon: r.horizon ?? null,
      runId: r.run_id ?? null,
    });

  const agentTasks = {
    insert(input: AgentTaskInput): void {
      const t = AgentTaskSchema.parse(input);
      db.prepare(
        `INSERT OR REPLACE INTO agent_tasks
           (id, agent_id, title, status, created_at, updated_at, detail, due_at, priority, owner_kind, horizon, run_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        t.id, t.agentId ?? '', t.title, t.status, t.createdAt, t.updatedAt,
        t.detail, t.dueAt, t.priority, t.ownerKind, t.horizon, t.runId,
      );
    },
    get(id: string): AgentTask | null {
      const r = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id);
      return r ? rowToTask(r) : null;
    },
    byAgent(agentId: string): AgentTask[] {
      return db
        .prepare('SELECT * FROM agent_tasks WHERE agent_id = ? ORDER BY created_at DESC, rowid DESC')
        .all(agentId)
        .map(rowToTask);
    },
    all(): AgentTask[] {
      return db.prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC, rowid DESC').all().map(rowToTask);
    },
    setStatus(id: string, status: AgentTask['status'], updatedAt: string): void {
      AgentTaskStatusSchema.parse(status);
      db.prepare('UPDATE agent_tasks SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, id);
    },
    /** Partial edit of the fields the task drawer owns. Validates by round-
     *  tripping the whole task, so a bad patch can never reach the table. */
    update(
      id: string,
      patch: Partial<Pick<AgentTask, 'title' | 'detail' | 'dueAt' | 'priority' | 'horizon' | 'agentId' | 'ownerKind' | 'runId'>>,
      updatedAt: string,
    ): void {
      const current = this.get(id);
      if (!current) return;
      const next = AgentTaskSchema.parse({ ...current, ...patch, updatedAt });
      db.prepare(
        `UPDATE agent_tasks
            SET title = ?, detail = ?, due_at = ?, priority = ?, horizon = ?,
                agent_id = ?, owner_kind = ?, run_id = ?, updated_at = ?
          WHERE id = ?`,
      ).run(
        next.title, next.detail, next.dueAt, next.priority, next.horizon,
        next.agentId ?? '', next.ownerKind, next.runId, next.updatedAt, id,
      );
    },
    remove(id: string): void {
      db.prepare('DELETE FROM agent_tasks WHERE id = ?').run(id);
    },
  };

  const rowToCron = (r: any): AgentCron =>
    AgentCronSchema.parse({
      id: r.id, agentId: r.agent_id, schedule: r.schedule, description: r.description,
      enabled: Boolean(r.enabled), createdAt: r.created_at,
    });

  const agentCrons = {
    insert(c: AgentCron): void {
      AgentCronSchema.parse(c);
      if (!isValidCron(c.schedule)) throw new Error(`invalid cron schedule: ${c.schedule}`);
      db.prepare(
        'INSERT OR REPLACE INTO agent_crons (id, agent_id, schedule, description, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(c.id, c.agentId, c.schedule, c.description, c.enabled ? 1 : 0, c.createdAt);
    },
    byAgent(agentId: string): AgentCron[] {
      return db
        .prepare('SELECT * FROM agent_crons WHERE agent_id = ? ORDER BY created_at DESC, rowid DESC')
        .all(agentId)
        .map(rowToCron);
    },
    all(): AgentCron[] {
      return db.prepare('SELECT * FROM agent_crons ORDER BY created_at DESC, rowid DESC').all().map(rowToCron);
    },
    setEnabled(id: string, enabled: boolean): void {
      db.prepare('UPDATE agent_crons SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
    },
    remove(id: string): void {
      db.prepare('DELETE FROM agent_crons WHERE id = ?').run(id);
    },
  };

  const contactTags = {
    upsert(t: ContactTag): void {
      ContactTagSchema.parse(t);
      db.prepare(
        'INSERT INTO contact_tags (person, channel, tag, tier) VALUES (?, ?, ?, ?) ON CONFLICT(person, channel) DO UPDATE SET tag = excluded.tag, tier = excluded.tier',
      ).run(t.person, t.channel, t.tag, t.tier);
    },
    all(): ContactTag[] {
      return (db.prepare('SELECT * FROM contact_tags ORDER BY tier, person').all() as ContactTag[]).map(
        (r) => ContactTagSchema.parse(r),
      );
    },
    byTier(tier: number): ContactTag[] {
      return (
        db.prepare('SELECT * FROM contact_tags WHERE tier = ? ORDER BY person').all(tier) as ContactTag[]
      ).map((r) => ContactTagSchema.parse(r));
    },
    remove(person: string, channel: string): void {
      db.prepare('DELETE FROM contact_tags WHERE person = ? AND channel = ?').run(person, channel);
    },
  };

  return { agents, agentRuns, agentMessages, broadcasts, agentTasks, agentCrons, contactTags };
}
