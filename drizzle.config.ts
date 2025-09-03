import { defineConfig } from "drizzle-kit";
import fs from "fs";

const caFileCert = fs.existsSync("ca.crt") ? fs.readFileSync("ca.crt").toString() : undefined;
const envCert = process.env.DB_CERT;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST ?? "pg-2dc30e27-sccau.i.aivencloud.com",
    port: Number(process.env.DB_PORT ?? 11319),
    user: process.env.DB_USER ?? "avnadmin",
    password: process.env.DB_PASSWORD ?? "AVNS_ybNeXKZAZjVc2vpPU_v",
    database: process.env.DB_NAME ?? "defaultdb",
    ssl: envCert
      ? { rejectUnauthorized: true, ca: envCert }
      : caFileCert
        ? { rejectUnauthorized: true, ca: caFileCert }
        : false,
  },
});
