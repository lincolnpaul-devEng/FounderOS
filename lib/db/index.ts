import Database from 'better-sqlite3';
import { labStore } from '@/lib/lab/store';
import { tradingRepo } from '@/lib/db-ext/trading';
import { clientConfirmationsRepo, clientWorkRepo } from '@/lib/db-ext/clients';
import { leadMagnetsRepo } from '@/lib/db-ext/lead-magnets';
import { usageReadingsRepo } from '@/lib/db-ext/usage';
import { commsDigestsRepo } from '@/lib/db-ext/comms-digest';
import { callRecordingsRepo } from '@/lib/db-ext/recordings';
import { cronRunsRepo, deliverableDecisionsRepo } from '@/lib/db-ext/agent-ops';
import { coreRepos } from './repos/core';
import { agentRepos } from './repos/agents';
import { socialRepos } from './repos/social';
import { workflowRepos } from './repos/workflows';
import { funnelRepos } from './repos/funnel';
import { DDL } from './ddl';
import { LAB_DDL, migrateLabV2 } from './lab';
import {
  migrateAgentsTable,
  migrateWorkflowsTable,
  migrateFunnelContactsTable,
  migrateAgentTasksTable,
  migrateSkillsTable,
} from './migrate';
import { migrateFounderOs } from './founderos';
import { retireTables } from './retire';

export type GladosDb = ReturnType<typeof openDb>;

/**
 * Open (creating if necessary) the SQLite store for this data directory.
 * Every schema stage is idempotent, so an older database migrates in place
 * (FO_DDL / LAB_DDL / v2 columns / per-table column migrations / retired-table
 * drop). Returns the single repo-catalog object every backend module shares.
 */
export function openDb(path: string) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(DDL);
  db.exec(LAB_DDL); // Content Lab (additive)
  migrateLabV2(db); // Content Lab v2 columns (idempotent, 08.11.2)
  migrateAgentsTable(db);
  migrateFunnelContactsTable(db);
  migrateSkillsTable(db);
  migrateAgentTasksTable(db);
  migrateWorkflowsTable(db);
  migrateFounderOs(db); // FounderOS UI merge tables (additive)
  retireTables(db, path);

  return {
    ...coreRepos(db),
    ...agentRepos(db),
    ...socialRepos(db),
    ...workflowRepos(db),
    ...funnelRepos(db),
    /** Content Lab repository (lib/lab/store.ts). */
    lab: labStore(db),
    /* FounderOS UI merge repositories (lib/db-ext/*; tables in FO_DDL). */
    trading: tradingRepo(db),
    clientConfirmations: clientConfirmationsRepo(db),
    clientWork: clientWorkRepo(db),
    leadMagnets: leadMagnetsRepo(db),
    usageReadings: usageReadingsRepo(db),
    commsDigests: commsDigestsRepo(db),
    callRecordings: callRecordingsRepo(db),
    deliverableDecisions: deliverableDecisionsRepo(db),
    cronRuns: cronRunsRepo(db),
    /** The live journal mode, read from SQLite (S10 FR-17), e.g. "wal". */
    journalMode: (): string => String(db.pragma('journal_mode', { simple: true }) ?? ''),
    close: () => db.close(),
  };
}

// Re-exports so `@/lib/db` keeps the exact import surface lib/db.ts had.
export {
  migrateAgentsTable,
  migrateWorkflowsTable,
  migrateFunnelContactsTable,
  migrateAgentTasksTable,
  migrateSkillsTable,
  migrateLabV2,
  migrateFounderOs,
  retireTables,
  DDL,
  LAB_DDL,
};
export { deleteNotIn } from './ops';
export { FO_DDL, FO_TABLES } from './founderos';
export {
  LAB_V2_DDL,
  LEDGER_TRIGGERS_DDL,
  LAB_FORECASTS_TRIGGER_DDL,
  LAB_SCHEMA_VERSION,
  LAB_V2_COLUMNS,
  LAB_V2_INDEXES,
  lab_meta_version,
} from './lab';
export { RETIRED_TABLES, type RetireOutcome } from './retire';
