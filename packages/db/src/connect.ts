import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { Database } from './store.js';

/** The SQL migrations ship next to `src/` and `dist/`, so this resolves from both. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url));

export interface Connection {
  db: Database;
  close(): Promise<void>;
}

export async function connect(databaseUrl: string): Promise<Connection> {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => pool.end() };
}
