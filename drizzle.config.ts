import { defineConfig } from "drizzle-kit";
import fs from "fs";

// Check for DATABASE_URL existence, but don't throw immediately
// as we might be using detailed credentials.
const databaseUrl = process.env.DATABASE_URL;

const caCert = fs.existsSync("ca.crt") ? fs.readFileSync("ca.crt").toString() : undefined;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Prefer detailed credentials if available, otherwise use the URL
    host: "pg-2dc30e27-sccau.i.aivencloud.com",
    port: 11319,
    user: "avnadmin",
    password: "AVNS_ybNeXKZAZjVc2vpPU_v",
    database: "defaultdb",
    ssl: caCert ? {
      rejectUnauthorized: true,
      ca: caCert,
    } : false,
  },
  // Fallback for commands that might still rely on DATABASE_URL
  ...(databaseUrl && { url: databaseUrl }),
});
