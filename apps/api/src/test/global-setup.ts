import { runMigrations } from '../db/migrate';
import { TEST_DATABASE_URL } from './env';

// Runs once before the suite: bring the test database schema up to date.
export default async function setup(): Promise<void> {
  await runMigrations(TEST_DATABASE_URL);
}
