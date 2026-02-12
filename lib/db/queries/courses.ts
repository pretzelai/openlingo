import { db } from "@/lib/db";
import {
  course,
  unit,
  lesson,
  userCourseEnrollment,
  lessonCompletion,
} from "@/lib/db/schema";
import { eq, and, sql, count, countDistinct } from "drizzle-orm";
import type {
  Course,
  CourseListItem,
  EnrolledCourseInfo,
  Exercise,
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
      lessonCount: countDistinct(lesson.id),
    })
    .from(course)
    .leftJoin(unit, eq(unit.courseId, course.id))
    .leftJoin(lesson, eq(lesson.unitId, unit.id))
    .where(and(...conditions))
    .groupBy(course.id)
    .orderBy(course.title);

  return rows.map((r) => ({
    ...r,
    unitCount: Number(r.unitCount),
    lessonCount: Number(r.lessonCount),
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
    .where(eq(unit.courseId, courseId))
    .orderBy(unit.order);

  const unitIds = units.map((u) => u.id);
  if (unitIds.length === 0) {
    return {
      id: courseRow.id,
      title: courseRow.title,
      sourceLanguage: courseRow.sourceLanguage,
      targetLanguage: courseRow.targetLanguage,
      level: courseRow.level,
      units: [],
    };
  }

  const lessons = await db
    .select()
    .from(lesson)
    .where(
      sql`${lesson.unitId} IN ${unitIds}`
    )
    .orderBy(lesson.order);

  const lessonsByUnit = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const arr = lessonsByUnit.get(l.unitId) ?? [];
    arr.push(l);
    lessonsByUnit.set(l.unitId, arr);
  }

  return {
    id: courseRow.id,
    title: courseRow.title,
    sourceLanguage: courseRow.sourceLanguage,
    targetLanguage: courseRow.targetLanguage,
    level: courseRow.level,
    units: units.map((u) => ({
      title: u.title,
      description: u.description,
      order: u.order,
      icon: u.icon,
      color: u.color,
      lessons: (lessonsByUnit.get(u.id) ?? []).map((l) => ({
        title: l.title,
        order: l.order,
        xpReward: l.xpReward,
        exercises: l.exercises as Exercise[],
      })),
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
      currentUnitIndex: userCourseEnrollment.currentUnitIndex,
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
      lessonCount: countDistinct(lesson.id),
    })
    .from(course)
    .leftJoin(unit, eq(unit.courseId, course.id))
    .leftJoin(lesson, eq(lesson.unitId, unit.id))
    .where(sql`${course.id} IN ${courseIds}`)
    .groupBy(course.id);

  const completionCounts = await db
    .select({
      courseId: lessonCompletion.courseId,
      count: count(),
    })
    .from(lessonCompletion)
    .where(
      and(
        eq(lessonCompletion.userId, userId),
        sql`${lessonCompletion.courseId} IN ${courseIds}`
      )
    )
    .groupBy(lessonCompletion.courseId);

  const completionMap = new Map(
    completionCounts.map((c) => [c.courseId, Number(c.count)])
  );

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
      lessonCount: Number(c.lessonCount),
      currentUnitIndex: enrollment.currentUnitIndex,
      currentLessonIndex: enrollment.currentLessonIndex,
      completedLessons: completionMap.get(c.id) ?? 0,
    };
  });
}
