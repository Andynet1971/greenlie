import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { Database } from './store.js';

/**
 * The SQL migrations ship next to `src/` and `dist/`, so this resolves from both.
 *
 * Deliberately not `new URL('../drizzle', import.meta.url)`: bundlers (Turbopack,
 * webpack) special-case that exact pattern as a static asset reference and try to
 * trace/bundle the target, which fails here since it's a folder of `.sql` files
 * meant to be read at runtime, not a module.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_FOLDER = path.join(here, '../drizzle');

export interface Connection {
  db: Database;
  close(): Promise<void>;
}

export async function connect(databaseUrl: string): Promise<Connection> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  const db = drizzle(pool);
  return { db, close: () => pool.end() };
}

/**
 * Applies pending SQL migrations. Run once, from a dedicated step — not on every connect().
 *
 * `Database` is the cross-backend interface `Store` is written against (node-postgres in
 * production, PGlite in tests); the migrator only runs against a real Postgres connection,
 * which is what every caller of this function actually holds, from `connect()` in this file.
 */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db as NodePgDatabase<Record<string, unknown>>, { migrationsFolder: MIGRATIONS_FOLDER });
}
