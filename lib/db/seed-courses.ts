import { db } from "./index";
import { course, unit } from "./schema";
import { getAllCourses } from "../content/registry";
import type { UnitLesson } from "../content/types";

export async function seedCoursesFromFilesystem() {
  const courses = getAllCourses();

  for (const c of courses) {
    await db
      .insert(course)
      .values({
        id: c.id,
        title: c.title,
        sourceLanguage: c.sourceLanguage,
        targetLanguage: c.targetLanguage,
        level: c.level,
      })
      .onConflictDoNothing();

    for (let ui = 0; ui < c.units.length; ui++) {
      const u = c.units[ui];
      const unitId = `${c.id}-unit-${ui}`;

      // Convert lessons into the JSONB exercises array
      const exercises: UnitLesson[] = u.lessons.map((l) => ({
        title: l.title,
        xpReward: l.xpReward,
        exercises: l.exercises,
      }));

      await db
        .insert(unit)
        .values({
          id: unitId,
          courseId: c.id,
          title: u.title,
          description: u.description,
          icon: u.icon,
          color: u.color,
          exercises,
        })
        .onConflictDoNothing();
    }

    const totalLessons = c.units.reduce((sum, u) => sum + u.lessons.length, 0);
    console.log(
      `Seeded course "${c.id}": ${c.units.length} units, ${totalLessons} lessons`
    );
  }
}
