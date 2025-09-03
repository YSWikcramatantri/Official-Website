import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Aiven PostgreSQL configuration
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_CERT,
  },
};

console.log('🔗 Connecting to Aiven PostgreSQL database...');

export const pool = new Pool(config);
export const db = drizzle(pool, { schema });

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to Aiven database:', err);
    return;
  }

  if (!client) {
    console.error('❌ No client available');
    return;
  }

  console.log('✅ Successfully connected to Aiven PostgreSQL!');

  client.query('SELECT VERSION()', (err, result) => {
    release();
    if (err) {
      console.error('❌ Error querying database:', err);
      return;
    }
    console.log('📊 Database version:', result.rows[0].version);
  });
});