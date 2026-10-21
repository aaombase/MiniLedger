import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

// By default `pg` turns a DATE into a JS Date at *local* midnight, which shifts the day across timezones.
// Keep calendar dates as the raw 'YYYY-MM-DD' string instead.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// int8 (bigint, and COUNT/SUM(...)::bigint) comes back as a string by default.
// Every value we store is bounded far below Number.MAX_SAFE_INTEGER (see loan amount limits), but assert anyway.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error(`bigint ${value} does not fit in a JS number safely`);
  return n;
});

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];
export { schema };
