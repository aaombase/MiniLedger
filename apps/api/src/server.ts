import 'dotenv/config';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { systemClock } from './lib/clock';

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  const app = await buildApp({ config, db, clock: systemClock });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info('MiniLedger API ready. OTP codes are printed below as "[MOCK OTP]" lines (assignment-only).');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
