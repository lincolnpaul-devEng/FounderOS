# PROJECTS

Live board of what is being built here. Read at the start of every session
(after CLAUDE.md/AGENTS.md); update before the session ends. Absolute dates
only. The `## Checklist` section below is rendered under the terminal input:
keep it in sync with the tables above it.

## Shipped

### Rename: FounderOS → LegacyAI + repo hygiene (2026-10-31)
What changed, one line each:

| Area | Change | Where |
| --- | --- | --- |
| Product name | User-visible text is **LegacyAI** everywhere (brand mark `public/brand/legacyai-mark.png`, 503 page, setup/error copy). GladOS stays the private build under `LEGACYAI_BRAND=glados`. | `lib/brand.ts`, `middleware.ts`, copy spots in `lib/` + `app/` |
| Env naming | `LEGACYAI_*` is canonical; every site also reads the old `GLADOS_*` spelling. One helper, `lib/env.ts::envOf`. `FOUNDER_OS_DB` removed | `lib/env.ts` + 36 read sites, `.env.example`, `scripts/` |
| Database naming | Default file `data/legacyai.db`; pre-rename `glados.db` opens in place. `founder-os.db` support dropped | `lib/paths.ts` (`resolveDbPath`) |
| Auth/gates | Password/secret keys are `LEGACYAI_PASSWORD_HASH` / `LEGACYAI_SESSION_SECRET` (legacy keys read, written keys removed on edit); gates renamed `LEGACYAI_WRITES` / `LEGACYAI_CRON` with legacy pickup | `lib/auth.ts`, `lib/gates.ts` |
| Creds de-hardcoding | Machine-path `~/Projects/...` fallbacks replaced by `~/.config/legacyai/…` defaults + `LEGACYAI_AGENTS_ENV_FILE` / `SOCIAL_ENV_FILE` / `ARCADS_ENV_FILE` / `MCP_CONFIG_FILE` overrides; `arcadsReference` group removed | `lib/creds.ts`, connectors using it |
| db.ts split | The 2,318-line module is now `lib/db/` (`index.ts`, `ddl.ts`, `founderos.ts`, `lab.ts`, `migrate.ts`, `retire.ts`, `ops.ts`, `repos/{core,agents,social,workflows,funnel}.ts`) with a shared `deleteNotIn` helper. Import surface `@/lib/db` unchanged | `lib/db/` |
| package | `name: legacyai`; `@types/d3-force` moved to devDependencies; lockfile synced | `package.json` |
| Docs | README/LICENSE/AGENTS.md renamed; `.env.example` renamed with legacy-alias note + credential-file overrides; this file created | docs |

Verification run 2026-10-31: `npm run typecheck` green. Full suite executed in
26 alphabetical chunks (357 files). Every failure caused by the rename was
fixed (demo store naming, source-inspection paths, `.env.example` doc-sync
tests, lab setup brand ids). What still fails are ~15 tests of one family —
route-import tests timing out at the 5-second default on this slow machine —
and `tests/activity.test.ts`'s route timeout was reproduced on pristine HEAD,
so they are pre-existing, not rename fallout.

## Active

### Stated welcome: the legacy login + post-login splash (2026-11-01)
Ported the hand-authored `Stated Welcome Screen.html` into the OS as auth.

| Piece | What | Where |
| --- | --- | --- |
| Engine | Keyframe sampler + canvas mark renderer (noise trails), palette read from tokens | `components/staged/logoc.ts` |
| Login (legacy tree of /login) | Intro timeline (title wipe 4.0 · field 4.75 · Enter 4.95 · remember 5.35), empty submit shakes, busy/loader during the real fetch, wrong password rewinds with an error line, no demo auto-fill, Replay re-runs the intro, reduced-motion fast-forwards, `window.__stated` freeze hooks kept | `components/staged/StagedAuth.tsx` |
| Post-login take | Mark forms over the dashboard once per sign-in (sessionStorage flag from the login), then dissolves; reduced motion skips it | `components/staged/StagedSplash.tsx`, mounted in `app/layout.tsx` |
| Remain toggle | Real now: checked → 30-day cookie (as before), unchecked → browser-session cookie; other trees default to the old behaviour | `app/api/auth/login/route.ts`, `lib/auth.ts::sessionCookieOptions(stay)` |
| Styles | Authored palette tokenised under `.staged`/`.staged-splash` | `app/globals.css` tail |
| Tests | New `tests/staged-auth.test.ts` (engine + API + source pins + page assembly); `tests/legacy-only.test.ts` L-1 rewritten for the new truth. 13 + 151 green, smoke 57 green, typecheck green | tests |

Deliberately not ported from the html: the typed "Admin/pass" attract demo
(playing with fake credentials would be a lie on a real login), the name
field (the OS has one operator password), and the Google Fonts links (console
fonts are local).

## Debt carried

| Item | Origin | Note |
| --- | --- | --- |
| `next.config.mjs` `instrumentationHook` | Next 14 experimental flag | Move to auto-detection on the next deliberate Next.js upgrade |
| `lib/compute/miosa.ts` `tenant: 'founderos'` | Compute provider tenant slug | External identifier; renamed only if the provider account moves |
| Route-import tests time out at 5 s on this machine | vitest default `testTimeout`, slow transform | Pre-existing; visible on pristine HEAD; raise `testTimeout` or split route imports if it annoys |

## Checklist

- [x] Run `npm run typecheck` end-to-end and resolve any stragglers (2026-10-31)
- [x] Run `npm test` (full suite, chunked) and resolve rename fallout (2026-10-31)
- [x] Review `.env.local` compatibility path: `GLADOS_*` legacy aliases keep it loading
- [ ] Operator decides when to share/announce the rename
