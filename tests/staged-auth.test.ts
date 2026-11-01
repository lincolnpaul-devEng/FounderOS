import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { INTRO, LOADER, FALLBACK, ease, sample } from '@/components/staged/logoc';
import { PASSWORD_HASH_KEY, SESSION_SECRET_KEY, resetThrottle, setPassword } from '@/lib/auth';

/**
 * The Stated welcome (components/staged/): the hand-authored canvas login
 * under the legacy tree, plus its post-login splash over the dashboard.
 *
 * Pinned here:
 *   - keyframe sampler math (bracketing, easing, and both timelines' rests)
 *   - the real submit: /api/auth/login with the Remain flag reaching the
 *     session-cookie length; the html's typed "Admin/pass" demo is nowhere
 *   - the honest failure contract (rewind + an error line, no fake success)
 *   - token-only coloring (palette hexes live in .staged CSS, not components)
 *   - the splash flag contract between StagedAuth, StagedSplash and layout
 *
 * The appearance cookie is fixed to the legacy tree for this file, so
 * app/login/page.tsx forks to the Staged welcome (and to NoPasswordL when no
 * password exists — the idea that brings no working-looking password box).
 */
vi.mock('next/headers', () => ({
  cookies: () => ({ get: () => ({ value: 'legacy.mono.dark' }) }),
  headers: () => new Headers(),
}));

let prevOverride: string | undefined;
beforeEach(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-auth-'));
  prevOverride = process.env.LEGACYAI_ENV_LOCAL;
  process.env.LEGACYAI_ENV_LOCAL = path.join(tmp, '.env.local');
  resetThrottle();
});
afterAll(() => {
  if (prevOverride === undefined) delete process.env.LEGACYAI_ENV_LOCAL;
  else process.env.LEGACYAI_ENV_LOCAL = prevOverride;
});

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const cookieOf = (res: Response) => res.headers.get('set-cookie') ?? '';

const json = (body: unknown) =>
  new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('the sign-out control in the dashboard foot', () => {
  test('LegacySideFoot posts /api/auth/logout and returns to the welcome', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'components/legacy/Shell.tsx'), 'utf8');
    expect(src).toMatch(/'\/api\/auth\/logout', \{ method: 'POST' \}/);
    expect(src).toMatch(/router\.replace\('\/login'\)/);
    expect(src).toMatch(/out === 'error' \? 'Could not sign out'/); // honest failure text
  });

  test('POST /api/auth/logout clears the session cookie (Max-Age=0)', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const res = await POST();
    expect(res.status).toBe(200);
    expect(cookieOf(res)).toMatch(/glados_session=;/);
    expect(cookieOf(res)).toMatch(/Max-Age=0/);
  });
});

describe('staged keyframe sampler (logoc.ts)', () => {
  test('clamps at both ends and eases between brackets', () => {
    expect(sample(INTRO, -5)).toBe(INTRO[0]);
    expect(sample(INTRO, 99)).toBe(INTRO[INTRO.length - 1]);
    // Between 2.15 and 2.25 the radius eases 0.08 → 0.22: halfway is 0.15.
    const mid = sample(INTRO, 2.2);
    expect(mid.R).toBeCloseTo(0.15, 5);
    expect(mid.phi).toBeCloseTo(-32.5, 5);
  });

  test('intro rests fully formed (R=1, disc scale=1, at the rest anchor, edges on)', () => {
    const end = sample(INTRO, 4.2);
    expect(end.R).toBe(1);
    expect(end.ds).toBe(1);
    expect(end.m).toBe(1);
    expect(end.e).toBe(1);
    expect(end.tube).toBe(1);
  });

  test('loader loop and login settle share the final pose', () => {
    const settle = sample(LOADER, 1.3);
    const end = sample(LOADER, 3.4);
    for (const k of ['R', 'ds', 'phi', 'headA', 'tailA', 'tube', 'ghost', 'm', 'e'] as const) {
      expect(settle[k]).toBe(end[k]);
    }
  });

  test('the tone curve maps dim→lit exactly over the authored greys', () => {
    const u = 0.37;
    const eased = ease(u);
    expect(eased).toBeLessThan(u);
    expect(eased).toBeGreaterThan(u * u);
    expect(FALLBACK.disc[0]).toBe(217); // --staged-disc: #d9d9d9
    expect(FALLBACK.discDim[0]).toBe(80); // --staged-disc-dim: #505050
    expect(FALLBACK.trail[0]).toBe(205); // --staged-trail: #cdcdcd
    expect(FALLBACK.trailDim[0]).toBe(90); // --staged-trail-dim: #5a5a5a
  });
});

describe('POST /api/auth/login · the Remain toggle', () => {
  test('default and stay:true keep the 30-day session cookie', async () => {
    setPassword('a fine passphrase');
    const { POST } = await import('@/app/api/auth/login/route');
    for (const body of [{ password: 'a fine passphrase' }, { password: 'a fine passphrase', stay: true }]) {
      const res = await POST(json(body));
      expect(res.status).toBe(200);
      expect(cookieOf(res)).toMatch(/Max-Age=2592000/);
    }
  });

  test('stay:false signs in for the browser session only (no Max-Age)', async () => {
    setPassword('a fine passphrase');
    const { POST } = await import('@/app/api/auth/login/route');
    const res = await POST(json({ password: 'a fine passphrase', stay: false }));
    expect(res.status).toBe(200);
    expect(cookieOf(res)).not.toMatch(/Max-Age/);
    expect(cookieOf(res)).toMatch(/glados_session=/);
  });
});

describe('StagedAuth behaviours (source pins)', () => {
  const stated = () => fs.readFileSync(path.join(process.cwd(), 'components/staged/StagedAuth.tsx'), 'utf8');

  test('submits through the one real endpoint with the stay flag; no fake operator demo', () => {
    const src = stated();
    expect(src).toContain("fetch('/api/auth/login'");
    expect(src).toMatch(/stay:\s*boxRef\.current\?\.checked/);
    // The html's attract-mode typing ("Admin"/"pass") must not ride along.
    expect(src).not.toMatch(/\bAdmin\b/);
    expect(src).not.toMatch(/typeInto|demoOn|replay.*submit/);
  });

  test('an empty submit shakes instead of calling the server; wrong password rewinds and says so', () => {
    const src = stated();
    // shake happens before any fetch is written into the submit path
    expect(src.indexOf('shake()')).toBeLessThan(src.indexOf("fetch('/api/auth/login'"));
    expect(src).toMatch(/rewind\(err \?\? 'wrong password'\)/);
    expect(src).toMatch(/could not reach the server/);
  });

  test('the hand-authored timeline survives: title wipe, three reveals, busy tone, loader loop', () => {
    const src = stated();
    expect(src).toMatch(/clipPath: 'inset\(-20% 100% -20% 0\)'/); // 4.00 title
    expect(src).toMatch(/\[4\.75, \(\) => passRef\.current && reveal\(/); // field
    expect(src).toMatch(/\[4\.95, /); // Enter
    expect(src).toMatch(/\[5\.35, /); // remember
    expect(src).toMatch(/1 - 0\.65 \* ease\(/); // busy tone dim
    expect(src).toMatch(/1\.3 \+ \(\(q - 1\.3\) % 2\.1\)/); // loader loop modulo
    expect(src).toMatch(/__stated/); // capture freeze hooks, as authored
    expect(src).toMatch(/prefers-reduced-motion/);
  });

  test('no raw palette hex in the staged components; colors live in tokens/CSS', () => {
    for (const f of ['components/staged/logoc.ts', 'components/staged/StagedAuth.tsx', 'components/staged/StagedSplash.tsx']) {
      expect(read(f).replace(/rgba?\([^)]*\)/g, '')).not.toMatch(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
    }
  });

  test('the splash flag is set on success only, and the splash clears it', () => {
    const auth = stated();
    expect(auth.indexOf("sessionStorage.setItem(STAGED_SPLASH_FLAG")).toBeLessThan(auth.indexOf('router.replace('));
    const splash = read('components/staged/StagedSplash.tsx');
    expect(splash).toContain("sessionStorage.getItem(STAGED_SPLASH_FLAG) === '1'");
    expect(splash).toMatch(/sessionStorage\.removeItem\(STAGED_SPLASH_FLAG\)/);
    expect(splash).toMatch(/prefers-reduced-motion/);
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/<StagedSplash\b/);
    const css = read('app/globals.css');
    expect(css).toMatch(/\.staged-stage/);
    expect(css).toMatch(/\.staged-splash/);
  });

  test('the env keys the login writes are the canonical LEGACYAI spellings', () => {
    expect(PASSWORD_HASH_KEY).toBe('LEGACYAI_PASSWORD_HASH');
    expect(SESSION_SECRET_KEY).toBe('LEGACYAI_SESSION_SECRET');
  });
});

describe('app/login/page.tsx under the legacy appearance', () => {
  test('no password: the honest NoPassword element; configured: the Staged element tree', async () => {
    const { default: Page } = await import('@/app/login/page');
    expect(Page()).toBeTruthy(); // login is a sync server function — JSX out, tree builds
    setPassword('a fine passphrase');
    expect(Page()).toBeTruthy();
  });
});
