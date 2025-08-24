import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Aiven PostgreSQL configuration
const config = {
  user: "avnadmin",
  password: "AVNS_ybNeXKZAZjVc2vpPU_v",
  host: "pg-2dc30e27-sccau.i.aivencloud.com",
  port: 11319,
  database: "defaultdb",
  ssl: {
    rejectUnauthorized: true,
    ca: `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIUfABmt1KIqyySe9goPWcM0DS4gMYwDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1MmU3OTcwNTctNWRlNS00YjA3LWJhNmEtMDBmYWU0NjY0
NDljIEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwODI0MDQzNTUyWhcNMzUwODIyMDQz
NTUyWjBAMT4wPAYDVQQDDDUyZTc5NzA1Ny01ZGU1LTRiMDctYmE2YS0wMGZhZTQ2
NjQ0OWMgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAJ5lahHlh/gK3xB/IHCuvkOQnhldsD0ypCqABH+tVuwTn+KYAeCBazEj
hHhH2WWWd61Y/P2C975O+YCQHcUb/2Uxl/5TQoj7bOMHxa1+/e0sJ0HQhcj5yJ2O
zVIEY8dBglrh12SeF9ySn6j5Dse/dE6ZL9cNjRgc2/pRid3uZWC4ayo7MXUvhEcd
oHZOICrF4D8sER6dVkoYBsC/17TdEcfmuGMGbhssTqMMfkr52b2diRUKDq5xv5DB
Ts/eVj9fZ+49CMc8i+3wLV+ltN03UNQntqpUfUf5N2QqOVmZualdpSm56uWph4Sw
jLczIpqmP9w/QgvAZuJcZs6BJ2kcJqzwjqLGoOnP9KKq1+03Ew2dAppa89bRk4Vi
gprjYUmjt36lIPx97WS8ra91Ricpn5ees3rHEbwIiEo0y0kPtEtvZKOpqI1OoTjN
pH50eumaW3FrduZgT5N860tsh6sb4PawxkdgS3dVxuBxuS0VoFYzv9YxXLT0W2ak
ochCX9tI2wIDAQABo0IwQDAdBgNVHQ4EFgQUnMEgHVIq0HhU3VIYb2+msB/WGEsw
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAGldnuKbh8F2c5pTZr2v9UZvg2x0s2m7h7XPspRCtNqj3zrKeXZfzU3ItDhO
+r0tTtiBfMFLtgRyEAEV2OrliszCcM1VopLRrqGHN+Aa2WUN+dhth6OULvPUPLFV
U5bUu1P5mhk0DdnzT71UbS9BRD8m6sifR5r77vbt1B+WcfkYUrLR7olz0ivUg6z+
zhGIWlafGJII2b87QZ7b0bQczpP0VxD8+rCxGcyO9Dl9C2cbWawqKTtB8ZhQAouK
XuAD0Pr+f6pLGCyu6Znjnz3p41eJnbz47aGyRRD2kbEHVfAUojNrMLjauEYUeSEd
7NqmuDj694rb48I0NZkUWLvnCbzzc5ZmEQq1ZwDuA8PvuqWv+wUb8pAVOWfygOXQ
v/cWZmdBBtLcP8v7k6ThPbfaqe/txVXvFOajCwmAVW6cGwZ2NDY2+UKpoNC6RJNF
qquvaRqgqFmA7kz4DO5MSXVD6iiFUhc07N9jRWVqNCp+uAH1Ht2CLLOBs2fEnqqM
wQEiAw==
-----END CERTIFICATE-----`,
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