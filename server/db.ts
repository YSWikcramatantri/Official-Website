import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// PostgreSQL configuration (env-driven). If env vars are missing, we still
// create the pool without forcing an immediate connection. This lets the
// dev server boot even without a DB; API calls that touch the DB will fail
// until proper credentials are provided.
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME,
  ssl: process.env.DB_CERT
    ? { rejectUnauthorized: true, ca: process.env.DB_CERT }
    : undefined,
} as const;

let _pool: Pool;
try {
  _pool = new Pool(config as any);
} catch (err) {
  console.error('Failed to create PG pool with provided SSL configuration, falling back to no SSL:', err);
  const fallback = { ...config, ssl: undefined } as any;
  _pool = new Pool(fallback);
}
export const pool = _pool;
export const db = drizzle(pool, { schema });
