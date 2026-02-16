import { seedAchievements } from "../lib/db/seed-achievements";
import { seedCoursesFromFilesystem } from "../lib/db/seed-courses";
import { seedTestUser } from "../lib/db/seed-test-user";
import { seedWords } from "../lib/db/seed-words";

async function main() {
  console.log("Seeding achievements...");
  await seedAchievements();

  console.log("Seeding courses from filesystem...");
  await seedCoursesFromFilesystem();

  console.log("Seeding test user...");
  await seedTestUser();

  console.log("Seeding dictionary words...");
  await seedWords();

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
