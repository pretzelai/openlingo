import { seedCoursesFromFilesystem } from "../lib/db/seed-courses";
import { seedWords } from "../lib/db/seed-words";

async function main() {
  console.log("Seeding courses from filesystem...");
  await seedCoursesFromFilesystem();

  console.log("Seeding dictionary words...");
  await seedWords();

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
