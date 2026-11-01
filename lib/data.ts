import path from 'node:path';
import fs from 'node:fs';
import { openDb, type GladosDb } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { dataPath, resolveDbPath } from '@/lib/paths';
import { envOf } from '@/lib/env';
import { ensureDemoStore } from '@/lib/demo/store';

/**
 * App-level singleton. Larp-first, real-ready: every page and API route reads
 * through this seeded SQLite database, so swapping in live sources later is a
 * repo-level change, not a UI rewrite.
 */
let instance: GladosDb | null = null;

/**
 * Where the database lives: LEGACYAI_DB, or `legacyai.db` in the data
 * directory (the retired `glados.db` naming keeps working in place), decided
 * by lib/paths.resolveDbPath — the single naming authority. Kept here for
 * compatibility with existing imports.
 */
export { resolveDbPath } from '@/lib/paths';

export function getDb(): GladosDb {
  if (instance) return instance;
  // Demo mode opens on the demo company: built on first use, rebuilt weekly.
  if (!envOf('DB')) ensureDemoStore();
  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  instance = openDb(dbPath);
  // Seed the structural rows (departments) on first touch. Everything else
  // starts empty: a fresh install is a blank OS the operator fills in.
  if (instance.departments.all().length === 0) {
    seedDatabase(instance);
  }
  return instance;
}
