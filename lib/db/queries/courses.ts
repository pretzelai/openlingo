import { db } from "@/lib/db";
import {
  course,
  unit,
  userCourseEnrollment,
  lessonCompletion,
} from "@/lib/db/schema";
import {
  eq,
  and,
  or,
  sql,
  isNull,
  count,
  countDistinct,
} from "drizzle-orm";
import type {
  Course,
  CourseListItem,
  EnrolledCourseInfo,
  StandaloneUnitInfo,
  UnitWithContent,
} from "@/lib/content/types";
import { getUnitLessons } from "@/lib/content/loader";

interface CourseFilters {
  sourceLanguage?: string;
  targetLanguage?: string;
  level?: string;
}

export async function listCourses(
  filters?: CourseFilters,
  userId?: string
): Promise<CourseListItem[]> {
  const conditions = [eq(course.published, true)];

  // Course-level visibility: public OR owned by the current user
  if (userId) {
    conditions.push(
      or(eq(course.visibility, "public"), eq(course.createdBy, userId))!
    );
  } else {
    conditions.push(eq(course.visibility, "public"));
  }

  if (filters?.sourceLanguage) {
    conditions.push(eq(course.sourceLanguage, filters.sourceLanguage));
  }
  if (filters?.targetLanguage) {
    conditions.push(eq(course.targetLanguage, filters.targetLanguage));
  }
  if (filters?.level) {
    conditions.push(eq(course.level, filters.level));
  }

  // Only count visible units (public OR owned by the current user)
  const unitJoinCondition = userId
    ? and(
        eq(unit.courseId, course.id),
        or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))
      )
    : and(eq(unit.courseId, course.id), eq(unit.visibility, "public"));

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
    .leftJoin(unit, unitJoinCondition)
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
  filters?: CourseFilters,
  userId?: string
): Promise<CourseListItem[]> {
  const courses = await listCourses(filters, userId);
  if (courses.length === 0) return courses;

  const courseIds = courses.map((c) => c.id);

  // Only count lessons from visible units
  const unitVisibilityCondition = userId
    ? and(
        sql`${unit.courseId} IN ${courseIds}`,
        or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))
      )
    : and(
        sql`${unit.courseId} IN ${courseIds}`,
        eq(unit.visibility, "public")
      );

  const units = await db
    .select({ id: unit.id, courseId: unit.courseId, markdown: unit.markdown })
    .from(unit)
    .where(unitVisibilityCondition);

  const lessonCountByCourse = new Map<string, number>();
  for (const u of units) {
    if (!u.courseId) continue;
    const lessons = getUnitLessons(u.markdown);
    const prev = lessonCountByCourse.get(u.courseId) ?? 0;
    lessonCountByCourse.set(u.courseId, prev + lessons.length);
  }

  return courses.map((c) => ({
    ...c,
    lessonCount: lessonCountByCourse.get(c.id) ?? 0,
  }));
}

export async function getCourseWithContent(
  courseId: string,
  userId?: string
): Promise<Course | null> {
  // Course-level visibility: public OR owned by the current user
  const courseConditions = [eq(course.id, courseId)];
  if (userId) {
    courseConditions.push(
      or(eq(course.visibility, "public"), eq(course.createdBy, userId))!
    );
  } else {
    courseConditions.push(eq(course.visibility, "public"));
  }

  const [courseRow] = await db
    .select()
    .from(course)
    .where(and(...courseConditions));

  if (!courseRow) return null;

  // Unit-level visibility: public OR owned by the current user
  const unitConditions = [eq(unit.courseId, courseId)];
  if (userId) {
    unitConditions.push(
      or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))!
    );
  } else {
    unitConditions.push(eq(unit.visibility, "public"));
  }

  const units = await db
    .select()
    .from(unit)
    .where(and(...unitConditions));

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
      lessons: getUnitLessons(u.markdown),
    })),
  };
}

export async function getAvailableFilters(userId?: string) {
  const conditions = [eq(course.published, true)];
  if (userId) {
    conditions.push(
      or(eq(course.visibility, "public"), eq(course.createdBy, userId))!
    );
  } else {
    conditions.push(eq(course.visibility, "public"));
  }

  const rows = await db
    .select({
      sourceLanguage: course.sourceLanguage,
      targetLanguage: course.targetLanguage,
      level: course.level,
    })
    .from(course)
    .where(and(...conditions));

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

  // Only count visible units (public OR owned by the user)
  const unitJoinCondition = and(
    eq(unit.courseId, course.id),
    or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))
  );

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
    .leftJoin(unit, unitJoinCondition)
    .where(sql`${course.id} IN ${courseIds}`)
    .groupBy(course.id);

  // Count completed lessons per course via unit join (only visible units)
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
        sql`${unit.courseId} IN ${courseIds}`,
        or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))
      )
    )
    .groupBy(unit.courseId);

  const completionMap = new Map(
    completionCounts.map((c) => [c.courseId, Number(c.count)])
  );

  // Get lesson counts from markdown (only visible units)
  const allUnits = await db
    .select({ id: unit.id, courseId: unit.courseId, markdown: unit.markdown })
    .from(unit)
    .where(
      and(
        sql`${unit.courseId} IN ${courseIds}`,
        or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))
      )
    );

  const lessonCountMap = new Map<string, number>();
  for (const u of allUnits) {
    if (!u.courseId) continue;
    const lessons = getUnitLessons(u.markdown);
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

export async function getStandaloneUnits(
  userId: string
): Promise<StandaloneUnitInfo[]> {
  const units = await db
    .select()
    .from(unit)
    .where(
      and(
        isNull(unit.courseId),
        or(eq(unit.createdBy, userId), eq(unit.visibility, "public"))
      )
    );

  return units.map((u) => ({
    id: u.id,
    title: u.title,
    description: u.description,
    icon: u.icon,
    color: u.color,
    targetLanguage: u.targetLanguage,
    sourceLanguage: u.sourceLanguage,
    level: u.level,
    lessonCount: getUnitLessons(u.markdown).length,
  }));
}

export async function getUnitWithContent(
  unitId: string
): Promise<UnitWithContent | null> {
  const [u] = await db.select().from(unit).where(eq(unit.id, unitId));
  if (!u) return null;

  return {
    id: u.id,
    title: u.title,
    description: u.description,
    icon: u.icon,
    color: u.color,
    targetLanguage: u.targetLanguage,
    sourceLanguage: u.sourceLanguage,
    level: u.level,
    courseId: u.courseId,
    lessons: getUnitLessons(u.markdown),
  };
}
