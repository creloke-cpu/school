import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const here = path.dirname(fileURLToPath(import.meta.url));
export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const files = (await fs.readdir(path.join(here, '..', 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const version = file.split('_')[0];
    const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version]);
    if (!rowCount) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); await client.query(await fs.readFile(path.join(here, '..', 'migrations', file), 'utf8')); await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]); await client.query('COMMIT'); }
      catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  }
}
