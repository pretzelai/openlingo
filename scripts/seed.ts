import { seedAchievements } from "../lib/db/seed-achievements";
import { seedCoursesFromFilesystem } from "../lib/db/seed-courses";

async function main() {
  console.log("Seeding achievements...");
  await seedAchievements();

  console.log("Seeding courses from filesystem...");
  await seedCoursesFromFilesystem();

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
