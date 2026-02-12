import { db } from "./index";
import { course, unit, lesson } from "./schema";
import { getAllCourses } from "../content/registry";

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

      await db
        .insert(unit)
        .values({
          id: unitId,
          courseId: c.id,
          title: u.title,
          description: u.description,
          icon: u.icon,
          color: u.color,
          order: ui,
        })
        .onConflictDoNothing();

      for (let li = 0; li < u.lessons.length; li++) {
        const l = u.lessons[li];
        const lessonId = `${c.id}-unit-${ui}-lesson-${li}`;

        await db
          .insert(lesson)
          .values({
            id: lessonId,
            unitId,
            title: l.title,
            order: li,
            xpReward: l.xpReward,
            exercises: l.exercises,
          })
          .onConflictDoNothing();
      }
    }

    console.log(
      `Seeded course "${c.id}": ${c.units.length} units, ${c.units.reduce((sum, u) => sum + u.lessons.length, 0)} lessons`
    );
  }
}
