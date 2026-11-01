# LegacyAI (built on GladOS): project notes for coding agents

Read this first. Same rules apply to any agent (see AGENTS.md).

## What this is
A Next.js 14 (app router) + SQLite personal operating system. One database,
opened via `lib/data.ts`: the store module lives in `lib/db/` (`lib/db/index.ts`
is the opener and re-export surface, `lib/db/ddl.ts` the core schema, repos per
domain under `lib/db/repos/`), typed with zod schemas in `lib/schemas.ts`.
Pages under `app/`, shared UI under `components/`, domain logic and connectors
under `lib/`. Tests are vitest (`tests/`), including `smoke.test.ts` (every
page renders) and `smoke-api.test.ts` (every GET route answers 200).

LegacyAI is the GladOS codebase plus two things of its own:
- `founderos/`: the Agents board and Social pages (`app/agents`, `app/social`)
  and the UI they need. They read the same database and connectors; nothing in
  `founderos/` has its own data layer. (The folder keeps this name for
  history; see Naming below.)
- `lib/demo/`: the demo company. A fresh clone runs in demo mode (Filming, in
  GladOS's words) and `lib/demo/store.ts` builds `demo-data/` from it on first
  start. Demo rows never go into `data/`.

## Naming
The product has layered names; be deliberate about which you touch:
- **LegacyAI** — the product/UI name, package name, docs. Canonical spelling
  for user-visible text; env keys are `LEGACYAI_*` (e.g. `LEGACYAI_DB`,
  `LEGACYAI_WRITES`).
- **GLADS→legacy aliases** — the old `GLADOS_*` env spelling is still read
  everywhere as a fallback (`lib/env.ts` is the one place that knows this).
  Do not introduce new `GLADOS_*` reads.
- **GladOS** — the private build, selected with `LEGACYAI_BRAND=glados`. Its
  brand id `glados` stays in code identifiers (storage keys, cookie names,
  launchd/job prefix). Not shown on the client product.
- **Bennett Legacy (ui `legacy` / theme "Legacy")** — one of the UI style
  options in the appearance system, unrelated to the product rename.
- **Filming** — demo mode (what GladOS calls it); the product copy keeps this
  word.
- The default database file is `data/legacyai.db`; a pre-rename `glados.db`
  file is opened in place if `legacyai.db` does not exist. There is no
  `FOUNDER_OS_DB` alias.

## Project board
`docs/PROJECTS.md` is the live board of what is being built here, its state,
and what each step is waiting on. Read it at the start of every session, right
after this file. Update it before the session ends whenever a step changes
state, a blocker clears, or a new project starts. Absolute dates only. Its
`## Checklist` section is rendered under the terminal input by the status
line: keep it in sync with the tables (tick items when done, add new ones,
`!` prefix = waiting on the operator). Multi-step projects have a folder
under `docs/projects/<name>/` with `TASKS.md`; when the operator picks a
project, read its folder first and brief them from it. Shipped projects move
to `docs/projects/_done/`, never deleted.

## House rules
- **Honest or absent.** No placeholder metrics, fake "connected" states, or
  demo text dressed as real data. An unconfigured integration shows a
  *Not configured* badge and a *Set up* link (`SetupLink` / `setupHrefFor`;
  `tests/setup-links.test.ts` enforces it).
- **Never commit secrets.** Track only `.env.example`. Keys are read through
  `lib/creds.ts` (credential files resolvable with `LEGACYAI_*_FILE`
  overrides, defaults under `~/.config`).
- **No emojis in UI.** Inline stroke icons only.
- **Every colour is a token** in `app/globals.css`; no raw hex in components.
- Keep the seed structural (`lib/seed.ts` seeds departments only): real data
  (`data/`) starts blank. Demo content belongs in `lib/demo/` and only ever
  reaches `demo-data/`.
- Run `npm test` and `npm run typecheck` before claiming a change works.

## Env
`LEGACYAI_DEFAULT_MODE` (`demo` unless set to `real`: what a fresh clone opens
on), `LEGACYAI_DB` (db path), `LEGACYAI_HOST` (bind address; loopback until a
password exists), `LEGACYAI_PASSWORD_HASH` + `LEGACYAI_SESSION_SECRET`
(written by Setup → Security, never hand-set), `LEGACYAI_WRITES` /
`LEGACYAI_CRON` (operator switches), `BRAIN_PROVIDER` / `GBRAIN_BIN` /
`GBRAIN_STORE` (brain), plus connector keys listed in `.env.example`. The
`GLADOS_*` spellings of the prefixed names still work.

## Debt
- `next.config.mjs` uses the experimental `instrumentationHook` flag (Next 14
  API). Move to auto-detection on the next deliberate Next.js upgrade.
