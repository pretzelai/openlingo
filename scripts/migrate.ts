import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, client } from "../lib/db";

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete!");
await client.end();
