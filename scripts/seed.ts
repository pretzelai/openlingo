import { seedAchievements } from "../lib/db/seed-achievements";

async function main() {
  console.log("Seeding achievements...");
  await seedAchievements();
  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
