import { sql } from "drizzle-orm";
import { db } from "../lib/db";

// Better Auth tables to preserve (don't drop these)
const AUTH_TABLES = ["user", "session", "account", "verification"];

// Get all tables in public schema
const rows = await db.execute<{ tablename: string }>(sql`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
`);

const allTables = [...rows].map((r) => r.tablename);
const tablesToDrop = allTables.filter((t) => !AUTH_TABLES.includes(t));

if (tablesToDrop.length > 0) {
  const quoted = tablesToDrop.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${quoted} CASCADE`));
  console.log(`Dropped tables: ${tablesToDrop.join(", ")}`);
} else {
  console.log("No app tables to drop.");
}

console.log(`Preserved auth tables: ${AUTH_TABLES.join(", ")}`);
process.exit(0);
