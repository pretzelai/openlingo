import { sql } from "drizzle-orm";
import { db } from "../lib/db";

// Tables to preserve (don't drop these)
const PRESERVED_TABLES = [
  "user", "session", "account", "verification", // Better Auth
  "audio_cache", // TTS cache (expensive to regenerate)
];

// Get all tables in public schema
const rows = await db.execute<{ tablename: string }>(sql`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
`);

const allTables = [...rows].map((r) => r.tablename);
const tablesToDrop = allTables.filter((t) => !PRESERVED_TABLES.includes(t));

if (tablesToDrop.length > 0) {
  const quoted = tablesToDrop.map((t) => `"${t}"`).join(", ");
  await db.execute(sql.raw(`DROP TABLE IF EXISTS ${quoted} CASCADE`));
  console.log(`Dropped tables: ${tablesToDrop.join(", ")}`);
} else {
  console.log("No app tables to drop.");
}

console.log(`Preserved tables: ${PRESERVED_TABLES.join(", ")}`);
process.exit(0);
