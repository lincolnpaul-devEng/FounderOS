import type Database from 'better-sqlite3';
import {
  DepartmentSchema, type Department,
  ToolSchema, type Tool,
  RoadmapItemSchema, type RoadmapItem,
  MetricSchema, type Metric,
  PhaseSchema, type Phase,
  SetupCheckSchema, type SetupCheck,
  BrandDealOverrideSchema, type BrandDealOverride,
  PersonSchema, type Person,
  SopTaskSchema, type SopTask,
  SkillSchema, type Skill,
} from '@/lib/schemas';
import { deleteNotIn } from '../ops';

/** Repos over the core OS tables; spread into the single store by lib/db (openDb). */
export function coreRepos(db: InstanceType<typeof Database>) {

  const departments = {
    all(): Department[] {
      return db
        .prepare('SELECT * FROM departments ORDER BY "order"')
        .all()
        .map((r) => DepartmentSchema.parse(r));
    },
    insert(d: Department): void {
      db.prepare(
        'INSERT OR REPLACE INTO departments (id, name, slug, tagline, color, "order") VALUES (?, ?, ?, ?, ?, ?)',
      ).run(d.id, d.name, d.slug, d.tagline, d.color, d.order);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      deleteNotIn(db, 'departments', ids);
    },
  };

  const tools = {
    all(): Tool[] {
      return db
        .prepare('SELECT * FROM tools ORDER BY category, name')
        .all()
        .map((r) => ToolSchema.parse(r));
    },
    insert(t: Tool): void {
      db.prepare(
        'INSERT OR REPLACE INTO tools (id, name, category, status, color, description) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(t.id, t.name, t.category, t.status, t.color, t.description);
    },
  };

  const roadmap = {
    all(): RoadmapItem[] {
      return db
        .prepare('SELECT * FROM roadmap_items ORDER BY quarter, title')
        .all()
        .map((r: any) =>
          RoadmapItemSchema.parse({
            id: r.id,
            title: r.title,
            quarter: r.quarter,
            status: r.status,
            departmentId: r.department_id,
            description: r.description,
          }),
        );
    },
    insert(item: RoadmapItem): void {
      db.prepare(
        'INSERT OR REPLACE INTO roadmap_items (id, title, quarter, status, department_id, description) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(item.id, item.title, item.quarter, item.status, item.departmentId, item.description);
    },
  };

  const metrics = {
    all(): Metric[] {
      return db
        .prepare('SELECT * FROM metrics ORDER BY label')
        .all()
        .map((r) => MetricSchema.parse(r));
    },
    insert(m: Metric): void {
      db.prepare(
        'INSERT OR REPLACE INTO metrics (id, key, label, value, unit, delta, period) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(m.id, m.key, m.label, m.value, m.unit, m.delta, m.period);
    },
  };

  const phases = {
    all(): Phase[] {
      return db
        .prepare('SELECT * FROM phases ORDER BY number')
        .all()
        .map((r: any) => PhaseSchema.parse({ ...r, items: JSON.parse(r.items) }));
    },
    insert(p: Phase): void {
      db.prepare('INSERT OR REPLACE INTO phases (id, number, title, items) VALUES (?, ?, ?, ?)').run(
        p.id,
        p.number,
        p.title,
        JSON.stringify(p.items),
      );
    },
  };

  const setupChecks = {
    set(id: string, doneAt: string): void {
      SetupCheckSchema.parse({ id, doneAt });
      db.prepare('INSERT OR REPLACE INTO setup_checks (id, done_at) VALUES (?, ?)').run(id, doneAt);
    },
    unset(id: string): void {
      db.prepare('DELETE FROM setup_checks WHERE id = ?').run(id);
    },
    all(): SetupCheck[] {
      return db
        .prepare('SELECT * FROM setup_checks')
        .all()
        .map((r: any) => SetupCheckSchema.parse({ id: r.id, doneAt: r.done_at }));
    },
  };

  const rowToBrandDealOverride = (r: any): BrandDealOverride =>
    BrandDealOverrideSchema.parse({
      dealId: r.deal_id, outcome: r.outcome, amountUsd: r.amount_usd ?? null, updatedAt: r.updated_at,
    });

  const brandDeals = {
    upsert(o: BrandDealOverride): void {
      BrandDealOverrideSchema.parse(o);
      db.prepare(
        'INSERT OR REPLACE INTO brand_deal_overrides (deal_id, outcome, amount_usd, updated_at) VALUES (?, ?, ?, ?)',
      ).run(o.dealId, o.outcome, o.amountUsd, o.updatedAt);
    },
    get(dealId: string): BrandDealOverride | null {
      const r = db.prepare('SELECT * FROM brand_deal_overrides WHERE deal_id = ?').get(dealId);
      return r ? rowToBrandDealOverride(r) : null;
    },
    all(): BrandDealOverride[] {
      return db.prepare('SELECT * FROM brand_deal_overrides').all().map(rowToBrandDealOverride);
    },
  };

  const people = {
    all(): Person[] {
      return db
        .prepare('SELECT * FROM people ORDER BY department_id, name')
        .all()
        .map((r: any) =>
          PersonSchema.parse({
            id: r.id,
            departmentId: r.department_id,
            name: r.name,
            role: r.role,
            tools: JSON.parse(r.tools),
          }),
        );
    },
    insert(p: Person): void {
      PersonSchema.parse(p);
      db.prepare(
        'INSERT OR REPLACE INTO people (id, department_id, name, role, tools) VALUES (?, ?, ?, ?, ?)',
      ).run(p.id, p.departmentId, p.name, p.role, JSON.stringify(p.tools));
    },
    deleteWhereIdNotIn(ids: string[]): void {
      deleteNotIn(db, 'people', ids);
    },
  };

  const sopTasks = {
    all(): SopTask[] {
      return db
        .prepare('SELECT * FROM sop_tasks ORDER BY department_id, title')
        .all()
        .map((r: any) =>
          SopTaskSchema.parse({
            id: r.id,
            departmentId: r.department_id,
            title: r.title,
            summary: r.summary,
            steps: JSON.parse(r.steps),
            assigneeKind: r.assignee_kind,
            assigneeId: r.assignee_id,
          }),
        );
    },
    insert(t: SopTask): void {
      SopTaskSchema.parse(t);
      db.prepare(
        'INSERT OR REPLACE INTO sop_tasks (id, department_id, title, summary, steps, assignee_kind, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(t.id, t.departmentId, t.title, t.summary, JSON.stringify(t.steps), t.assigneeKind, t.assigneeId);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      deleteNotIn(db, 'sop_tasks', ids);
    },
  };

  const skills = {
    all(): Skill[] {
      return db
        .prepare('SELECT * FROM skills ORDER BY ord, name')
        .all()
        .map((r: any) =>
          SkillSchema.parse({
            id: r.id,
            name: r.name,
            category: r.category,
            description: r.description,
            ownerAgentId: r.owner_agent_id,
            status: r.status,
            tools: JSON.parse(r.tools),
            markdown: r.markdown,
            order: r.ord,
          }),
        );
    },
    insert(s: Skill): void {
      SkillSchema.parse(s);
      db.prepare(
        'INSERT OR REPLACE INTO skills (id, name, category, description, owner_agent_id, status, tools, markdown, ord) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(s.id, s.name, s.category, s.description, s.ownerAgentId, s.status, JSON.stringify(s.tools), s.markdown, s.order);
    },
    deleteWhereIdNotIn(ids: string[]): void {
      deleteNotIn(db, 'skills', ids);
    },
  };

  return { departments, tools, roadmap, metrics, phases, setupChecks, brandDeals, people, sopTasks, skills };
}
