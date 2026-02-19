import { seedContentFromFilesystem } from "../lib/db/seed-content";
import { seedWords } from "../lib/db/seed-words";

async function main() {
  console.log("Seeding content from filesystem...");
  await seedContentFromFilesystem();

  console.log("Seeding dictionary words...");
  await seedWords();

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
