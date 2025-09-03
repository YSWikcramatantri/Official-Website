import { defineConfig } from "drizzle-kit";
import fs from "fs";

const caCert = fs.existsSync("ca.crt") ? fs.readFileSync("ca.crt").toString() : undefined;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
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
});
