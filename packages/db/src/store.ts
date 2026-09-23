import { BASELINE_VERDICTS, type HistoryEntry, type Verdict } from '@greenlie/core';
import { and, desc, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { checkState, runs, type CheckState, type NewRun, type Run } from './schema.js';

/** Any drizzle Postgres database: node-postgres in production, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

export interface Store {
  /** Creates the state row on first sight; `now` becomes `watchingSince`. */
  ensureCheck(checkId: string, now: Date): Promise<CheckState>;
  /** Read-only: the dashboard must never create a row just by looking. */
  getState(checkId: string): Promise<CheckState | undefined>;
  insertRun(run: NewRun): Promise<void>;
  /** The latest verdicts, oldest first. */
  recentVerdicts(checkId: string, limit: number): Promise<Verdict[]>;
  /**
   * The latest healthy runs with a volume, oldest first.
   *
   * Filtered in SQL on purpose: "the last N runs" would contain nothing
   * healthy after N thin runs in a row, the baseline would fall back to
   * learning, and a long outage would quietly stop being reported.
   */
  baselineHistory(checkId: string, limit: number): Promise<HistoryEntry[]>;
  latestRuns(checkId: string, limit: number): Promise<Run[]>;
  announce(checkId: string, verdict: Verdict, at: Date): Promise<void>;
  recordPing(checkId: string, at: Date): Promise<void>;
  /** Deletes runs older than `before`; returns how many. */
  pruneRuns(before: Date): Promise<number>;
}

export function createStore(db: Database): Store {
  return {
    async ensureCheck(checkId, now) {
      await db.insert(checkState).values({ checkId, watchingSince: now }).onConflictDoNothing();
      const [state] = await db.select().from(checkState).where(eq(checkState.checkId, checkId));
      if (!state) throw new Error(`check_state row for "${checkId}" vanished right after being created`);
      return state;
    },

    async getState(checkId) {
      const [state] = await db.select().from(checkState).where(eq(checkState.checkId, checkId));
      return state;
    },

    async insertRun(run) {
      await db.insert(runs).values(run);
    },

    async recentVerdicts(checkId, limit) {
      const rows = await db
        .select({ verdict: runs.verdict })
        .from(runs)
        .where(eq(runs.checkId, checkId))
        .orderBy(desc(runs.at), desc(runs.id))
        .limit(limit);
      return rows.map((row) => row.verdict).reverse();
    },

    async baselineHistory(checkId, limit) {
      const rows = await db
        .select({ verdict: runs.verdict, volume: runs.volume })
        .from(runs)
        .where(and(eq(runs.checkId, checkId), inArray(runs.verdict, [...BASELINE_VERDICTS]), isNotNull(runs.volume)))
        .orderBy(desc(runs.at), desc(runs.id))
        .limit(limit);
      return rows.reverse();
    },

    async latestRuns(checkId, limit) {
      return db.select().from(runs).where(eq(runs.checkId, checkId)).orderBy(desc(runs.at), desc(runs.id)).limit(limit);
    },

    async announce(checkId, verdict, at) {
      await db.update(checkState).set({ announced: verdict, announcedAt: at }).where(eq(checkState.checkId, checkId));
    },

    async recordPing(checkId, at) {
      await db.update(checkState).set({ lastPingAt: at }).where(eq(checkState.checkId, checkId));
    },

    async pruneRuns(before) {
      const deleted = await db.delete(runs).where(lt(runs.at, before)).returning({ id: runs.id });
      return deleted.length;
    },
  };
}
