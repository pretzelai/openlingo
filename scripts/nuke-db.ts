import { sql } from "drizzle-orm";
import { db } from "../lib/db";

await db.execute(sql`DROP SCHEMA public CASCADE`);
await db.execute(sql`CREATE SCHEMA public`);
console.log("Database nuked.");
process.exit(0);
