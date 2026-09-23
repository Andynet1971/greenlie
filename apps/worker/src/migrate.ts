import { connect, runMigrations } from '@greenlie/db';
import { readWorkerEnv } from './env.js';
import { createLogger } from './logger.js';

const log = createLogger();

function fail(message: string, errors: readonly string[]): never {
  log('error', message, { errors });
  process.exit(1);
}

const envResult = readWorkerEnv(process.env);
if (!envResult.ok) fail('invalid environment', envResult.errors);
const env = envResult.env;

const connection = await connect(env.databaseUrl);
try {
  await runMigrations(connection.db);
} catch (error) {
  fail('migration failed', [(error as Error).message]);
}
await connection.close();
log('info', 'migrations applied');
process.exit(0);
