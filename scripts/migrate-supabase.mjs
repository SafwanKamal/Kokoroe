import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const databaseUrl = process.env.SUPABASE_DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DIRECT_URL or DATABASE_URL is required.");
}

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260606062000_initial_kokoroe_schema.sql",
);
const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
});

try {
  await sql.unsafe(readFileSync(migrationPath, "utf8"));
  console.log("Supabase migration applied.");
} finally {
  await sql.end();
}
