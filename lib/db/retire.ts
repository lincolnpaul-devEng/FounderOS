import fs from 'node:fs';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';

/** Tables whose pages were removed (SPEC S12): Reference Model and Personas. */
export const RETIRED_TABLES = ['domains', 'personas'] as const;

export type RetireOutcome = {
  table: string;
  action: 'absent' | 'dropped' | 'exported' | 'kept';
  rows: number;
  /** The JSON export holding the rows (written now, or an identical earlier one). */
  file?: string;
  reason?: string;
};

function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function rowKeys(rows: Record<string, unknown>[]): string {
  return rows
    .map((r) => (r.id !== undefined ? String(r.id) : JSON.stringify(r)))
    .sort()
    .join('\n');
}

/**
 * Retire tables nothing reads any more (SPEC S12 §5.3): never lose rows
 * silently, never leave orphan tables behind. Per table: absent → skip;
 * empty → DROP; with rows → export to `<db dir>/retired/<table>-<date>.json`
 * (reusing an earlier export that holds the same ids, so a restored old
 * snapshot does not duplicate files), read the file back, check the row
 * count, then DROP in a transaction. Any failure keeps the table and logs one
 * warning; this never throws, so the app always opens. An in-memory DB has
 * no directory to export to and is simply dropped.
 */
export function retireTables(
  db: InstanceType<typeof Database>,
  dbPath: string,
  opts: { tables?: readonly string[]; now?: Date; warn?: (msg: string) => void } = {},
): RetireOutcome[] {
  const { tables = RETIRED_TABLES, now = new Date(), warn = (m: string) => console.warn(m) } = opts;
  const inMemory = dbPath === ':memory:' || dbPath === '';
  const out: RetireOutcome[] = [];
  for (const table of tables) {
    try {
      const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) {
        out.push({ table, action: 'absent', rows: 0 });
        continue;
      }
      const n = (db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n;
      const drop = db.transaction(() => db.exec(`DROP TABLE IF EXISTS "${table}"`));
      if (n === 0 || inMemory) {
        drop();
        out.push({ table, action: 'dropped', rows: n });
        continue;
      }
      const rows = db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all() as Record<string, unknown>[];
      const keys = rowKeys(rows);
      const dir = join(dirname(dbPath), 'retired');
      fs.mkdirSync(dir, { recursive: true });
      const readRows = (file: string): Record<string, unknown>[] | null => {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { table?: string; rows?: unknown };
          return parsed.table === table && Array.isArray(parsed.rows) ? (parsed.rows as Record<string, unknown>[]) : null;
        } catch {
          return null;
        }
      };
      // An earlier export of exactly these rows (any date) is reused.
      let file = fs
        .readdirSync(dir)
        .filter((f) => f.startsWith(`${table}-`) && f.endsWith('.json'))
        .map((f) => join(dir, f))
        .find((f) => {
          const prev = readRows(f);
          return prev !== null && prev.length === n && rowKeys(prev) === keys;
        });
      if (!file) {
        const stem = `${table}-${localDate(now)}`;
        let candidate = join(dir, `${stem}.json`);
        for (let i = 2; fs.existsSync(candidate); i++) candidate = join(dir, `${stem}-${i}.json`);
        const payload = { table, retiredOn: now.toISOString(), reason: 'spec 12: page removed', rows };
        fs.writeFileSync(candidate, `${JSON.stringify(payload, null, 2)}\n`);
        file = candidate;
      }
      const check = readRows(file);
      if (!check || check.length !== n) throw new Error(`export ${file} did not read back ${n} rows`);
      drop();
      out.push({ table, action: 'exported', rows: n, file });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      warn(`[db] retire ${table} skipped: ${reason}`);
      out.push({ table, action: 'kept', rows: -1, reason });
    }
  }
  return out;
}
