import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER, connect, type Connection } from './connect.js';

/**
 * A real, migrated, empty Postgres for one test file.
 *
 * With TEST_DATABASE_URL set (as in CI) it is a real server, emptied first.
 * Without it, PGlite: Postgres compiled to WebAssembly, in-process — so the
 * tests need no Docker and no install, and still never touch a mock.
 */
export async function createTestDatabase(): Promise<Connection> {
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const connection = await connect(url);
    await connection.db.execute(sql`truncate table runs, check_state restart identity`);
    return connection;
  }

  const client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, close: () => client.close() };
}
