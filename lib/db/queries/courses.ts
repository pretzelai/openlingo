import { db } from "@/lib/db";
import {
  course,
  unit,
  userCourseEnrollment,
  lessonCompletion,
} from "@/lib/db/schema";
import { eq, and, sql, count, countDistinct } from "drizzle-orm";
import type {
  Course,
  CourseListItem,
  EnrolledCourseInfo,
  UnitLesson,
} from "@/lib/content/types";

interface CourseFilters {
  sourceLanguage?: string;
  targetLanguage?: string;
  level?: string;
}

export async function listCourses(
  filters?: CourseFilters
): Promise<CourseListItem[]> {
  const conditions = [eq(course.published, true)];
  if (filters?.sourceLanguage) {
    conditions.push(eq(course.sourceLanguage, filters.sourceLanguage));
  }
  if (filters?.targetLanguage) {
    conditions.push(eq(course.targetLanguage, filters.targetLanguage));
  }
  if (filters?.level) {
    conditions.push(eq(course.level, filters.level));
  }

  const rows = await db
    .select({
      id: course.id,
      title: course.title,
      sourceLanguage: course.sourceLanguage,
      targetLanguage: course.targetLanguage,
      level: course.level,
      unitCount: countDistinct(unit.id),
    })
    .from(course)
    .leftJoin(unit, eq(unit.courseId, course.id))
    .where(and(...conditions))
    .groupBy(course.id)
    .orderBy(course.title);

  return rows.map((r) => ({
    ...r,
    unitCount: Number(r.unitCount),
    // Sum lesson counts from each unit's JSONB exercises array
    lessonCount: 0, // filled below
  }));
}

// Separate query for accurate lesson counts
export async function listCoursesWithLessonCounts(
  filters?: CourseFilters
): Promise<CourseListItem[]> {
  const courses = await listCourses(filters);
  if (courses.length === 0) return courses;

  const courseIds = courses.map((c) => c.id);
  const units = await db
    .select({ id: unit.id, courseId: unit.courseId, exercises: unit.exercises })
    .from(unit)
    .where(sql`${unit.courseId} IN ${courseIds}`);

  const lessonCountByCourse = new Map<string, number>();
  for (const u of units) {
    if (!u.courseId) continue;
    const lessons = u.exercises as UnitLesson[];
    const prev = lessonCountByCourse.get(u.courseId) ?? 0;
    lessonCountByCourse.set(u.courseId, prev + lessons.length);
  }

  return courses.map((c) => ({
    ...c,
    lessonCount: lessonCountByCourse.get(c.id) ?? 0,
  }));
}

export async function getCourseWithContent(
  courseId: string
): Promise<Course | null> {
  const [courseRow] = await db
    .select()
    .from(course)
    .where(eq(course.id, courseId));

  if (!courseRow) return null;

  const units = await db
    .select()
    .from(unit)
    .where(eq(unit.courseId, courseId));

  return {
    id: courseRow.id,
    title: courseRow.title,
    sourceLanguage: courseRow.sourceLanguage,
    targetLanguage: courseRow.targetLanguage,
    level: courseRow.level,
    units: units.map((u) => ({
      id: u.id,
      title: u.title,
      description: u.description,
      icon: u.icon,
      color: u.color,
      lessons: u.exercises as UnitLesson[],
    })),
  };
}

export async function getAvailableFilters() {
  const rows = await db
    .select({
      sourceLanguage: course.sourceLanguage,
      targetLanguage: course.targetLanguage,
      level: course.level,
    })
    .from(course)
    .where(eq(course.published, true));

  const sourceLanguages = [...new Set(rows.map((r) => r.sourceLanguage))].sort();
  const targetLanguages = [...new Set(rows.map((r) => r.targetLanguage))].sort();
  const levels = [...new Set(rows.map((r) => r.level))].sort();

  return { sourceLanguages, targetLanguages, levels };
}

export async function getUserEnrolledCourses(
  userId: string
): Promise<EnrolledCourseInfo[]> {
  const enrollments = await db
    .select({
      courseId: userCourseEnrollment.courseId,
      currentUnitId: userCourseEnrollment.currentUnitId,
      currentLessonIndex: userCourseEnrollment.currentLessonIndex,
    })
    .from(userCourseEnrollment)
    .where(eq(userCourseEnrollment.userId, userId));

  if (enrollments.length === 0) return [];

  const courseIds = enrollments.map((e) => e.courseId);

  const courses = await db
    .select({
      id: course.id,
      title: course.title,
      sourceLanguage: course.sourceLanguage,
      targetLanguage: course.targetLanguage,
      level: course.level,
      unitCount: countDistinct(unit.id),
    })
    .from(course)
    .leftJoin(unit, eq(unit.courseId, course.id))
    .where(sql`${course.id} IN ${courseIds}`)
    .groupBy(course.id);

  // Count completed lessons per course via unit join
  const completionCounts = await db
    .select({
      courseId: unit.courseId,
      count: count(),
    })
    .from(lessonCompletion)
    .innerJoin(unit, eq(unit.id, lessonCompletion.unitId))
    .where(
      and(
        eq(lessonCompletion.userId, userId),
        sql`${unit.courseId} IN ${courseIds}`
      )
    )
    .groupBy(unit.courseId);

  const completionMap = new Map(
    completionCounts.map((c) => [c.courseId, Number(c.count)])
  );

  // Get lesson counts from JSONB
  const allUnits = await db
    .select({ courseId: unit.courseId, exercises: unit.exercises })
    .from(unit)
    .where(sql`${unit.courseId} IN ${courseIds}`);

  const lessonCountMap = new Map<string, number>();
  for (const u of allUnits) {
    if (!u.courseId) continue;
    const lessons = u.exercises as UnitLesson[];
    lessonCountMap.set(u.courseId, (lessonCountMap.get(u.courseId) ?? 0) + lessons.length);
  }

  const enrollmentMap = new Map(
    enrollments.map((e) => [e.courseId, e])
  );

  return courses.map((c) => {
    const enrollment = enrollmentMap.get(c.id)!;
    return {
      id: c.id,
      title: c.title,
      sourceLanguage: c.sourceLanguage,
      targetLanguage: c.targetLanguage,
      level: c.level,
      unitCount: Number(c.unitCount),
      lessonCount: lessonCountMap.get(c.id) ?? 0,
      currentUnitId: enrollment.currentUnitId,
      currentLessonIndex: enrollment.currentLessonIndex,
      completedLessons: completionMap.get(c.id) ?? 0,
    };
  });
}
