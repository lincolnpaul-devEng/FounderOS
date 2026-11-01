import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveDbPath } from '@/lib/data';

// An upgraded install must never boot onto an empty database: data written
// before the rename lives in glados.db and has to be opened in place. (The
// first rename, from founder-os.db to glados.db, is no longer honoured: that
// generation of installs never shipped publicly.)
let dir: string;
const saved = { LEGACYAI_DATA_DIR: process.env.LEGACYAI_DATA_DIR, GLADOS_DATA_DIR: process.env.GLADOS_DATA_DIR };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacyai-dbpath-'));
  process.env.LEGACYAI_DATA_DIR = dir;
  delete process.env.GLADOS_DATA_DIR;
});
afterEach(() => {
  for (const key of ['LEGACYAI_DATA_DIR', 'GLADOS_DATA_DIR'] as const) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('database path', () => {
  test('a fresh data directory gets legacyai.db', () => {
    expect(resolveDbPath({})).toBe(path.join(dir, 'legacyai.db'));
  });

  test('an install from before the rename keeps opening glados.db', () => {
    fs.writeFileSync(path.join(dir, 'glados.db'), '');
    expect(resolveDbPath({})).toBe(path.join(dir, 'glados.db'));
  });

  test('once legacyai.db exists it wins over the legacy file', () => {
    fs.writeFileSync(path.join(dir, 'glados.db'), '');
    fs.writeFileSync(path.join(dir, 'legacyai.db'), '');
    expect(resolveDbPath({})).toBe(path.join(dir, 'legacyai.db'));
  });

  test('an explicit path wins', () => {
    expect(resolveDbPath({ LEGACYAI_DB: '/x/a.db' })).toBe('/x/a.db');
  });

  test('the legacy GLADOS_DB spelling still works, canonical comes first', () => {
    expect(resolveDbPath({ GLADOS_DB: '/x/b.db' })).toBe('/x/b.db');
    expect(resolveDbPath({ LEGACYAI_DB: '/x/a.db', GLADOS_DB: '/x/b.db' })).toBe('/x/a.db');
    expect(resolveDbPath({ LEGACYAI_DB: '', GLADOS_DB: '/x/b.db' })).toBe('/x/b.db');
  });
});
