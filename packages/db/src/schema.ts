import type { Verdict } from '@greenlie/core';
import { sql } from 'drizzle-orm';
import { bigserial, check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** One row per probe run: the history behind every baseline and every chart. */
export const runs = pgTable(
  'runs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    checkId: text('check_id').notNull(),
    at: at('at').notNull(),
    verdict: text('verdict').$type<Verdict>().notNull(),
    reason: text('reason').notNull(),
    status: integer('status'),
    latencyMs: integer('latency_ms'),
    volume: integer('volume'),
  },
  (t) => [
    index('runs_check_at_idx').on(t.checkId, t.at.desc()),
    check('runs_verdict_check', sql`${t.verdict} in ('ok', 'unknown', 'slow', 'thin', 'stale', 'down')`),
  ],
);

/** One row per check: what was last announced, and what heartbeats need. */
export const checkState = pgTable('check_state', {
  checkId: text('check_id').primaryKey(),
  /** When Greenlie started watching: the first heartbeat deadline counts from here. */
  watchingSince: at('watching_since').notNull(),
  /** The last settled verdict. Alerts fire when a new settled verdict differs. */
  announced: text('announced').$type<Verdict>(),
  announcedAt: at('announced_at'),
  lastPingAt: at('last_ping_at'),
});

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type CheckState = typeof checkState.$inferSelect;
