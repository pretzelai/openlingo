import { db } from "./index";
import { course, unit } from "./schema";
import { getAllCourses, getAllUnits } from "../content/registry";

export async function seedContentFromFilesystem() {
  const courses = getAllCourses();
  const units = getAllUnits();

  for (const c of courses) {
    await db
      .insert(course)
      .values({
        id: c.id,
        title: c.title,
        sourceLanguage: c.sourceLanguage,
        targetLanguage: c.targetLanguage,
        level: c.level,
        visibility: "public",
      })
      .onConflictDoNothing();
  }

  let seededCount = 0;
  for (const u of units) {
    const p = u.parsed;
    // targetLanguage is required on the DB column — skip units without it
    if (!p.targetLanguage) continue;

    await db
      .insert(unit)
      .values({
        courseId: p.courseId,
        title: p.title,
        description: p.description,
        icon: p.icon,
        color: p.color,
        markdown: u.markdown,
        targetLanguage: p.targetLanguage,
        sourceLanguage: p.sourceLanguage,
        level: p.level,
        visibility: "public",
      })
      .onConflictDoNothing();

    seededCount++;
  }

  console.log(
    `Seeded ${courses.length} course(s), ${seededCount} unit(s)`
  );
}
