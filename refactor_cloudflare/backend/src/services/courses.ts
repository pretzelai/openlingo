import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "../types";
import {
  course,
  lessonCompletion,
  unit,
  user,
  userUnitLibrary,
} from "../lib/db/schema";
import type {
  AvailableUnitForCourse,
  Course,
  CourseListItem,
  CourseManagementInfo,
  OwnedCourseInfo,
  StandaloneUnitInfo,
  UnitWithContent,
} from "../../../../lib/content/types";
import { getUnitLessonsSafe } from "../lib/content";

interface CourseFilters {
  sourceLanguage?: string;
  targetLanguage?: string;
  level?: string;
}

export async function listCourses(
  db: Database,
  filters?: CourseFilters,
  userId?: string,
): Promise<CourseListItem[]> {
  const conditions = [eq(course.published, true)];

  if (userId) {
    conditions.push(or(eq(course.visibility, "public"), eq(course.createdBy, userId))!);
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

  const unitJoinCondition = userId
    ? and(eq(unit.courseId, course.id), or(eq(unit.visibility, "public"), eq(unit.createdBy, userId)))
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

  return rows.map((row) => ({
    ...row,
    unitCount: Number(row.unitCount),
    lessonCount: 0,
  }));
}

export async function listCoursesWithLessonCounts(
  db: Database,
  filters?: CourseFilters,
  userId?: string,
): Promise<CourseListItem[]> {
  const courses = await listCourses(db, filters, userId);
  if (courses.length === 0) return courses;

  const courseIds = courses.map((entry) => entry.id);

  const unitVisibilityCondition = userId
    ? and(sql`${unit.courseId} IN ${courseIds}`, or(eq(unit.visibility, "public"), eq(unit.createdBy, userId)))
    : and(sql`${unit.courseId} IN ${courseIds}`, eq(unit.visibility, "public"));

  const units = await db
    .select({ id: unit.id, courseId: unit.courseId, markdown: unit.markdown })
    .from(unit)
    .where(unitVisibilityCondition);

  const lessonCountByCourse = new Map<string, number>();
  for (const item of units) {
    if (!item.courseId) continue;
    const { lessons } = getUnitLessonsSafe(item.markdown);
    const previous = lessonCountByCourse.get(item.courseId) ?? 0;
    lessonCountByCourse.set(item.courseId, previous + lessons.length);
  }

  return courses.map((entry) => ({
    ...entry,
    lessonCount: lessonCountByCourse.get(entry.id) ?? 0,
  }));
}

export async function getCourseWithContent(
  db: Database,
  courseId: string,
  userId?: string,
): Promise<Course | null> {
  const courseConditions = [eq(course.id, courseId)];
  if (userId) {
    courseConditions.push(or(eq(course.visibility, "public"), eq(course.createdBy, userId))!);
  } else {
    courseConditions.push(eq(course.visibility, "public"));
  }

  const [courseRow] = await db.select().from(course).where(and(...courseConditions));
  if (!courseRow) return null;

  const unitConditions = [eq(unit.courseId, courseId)];
  if (userId) {
    unitConditions.push(or(eq(unit.visibility, "public"), eq(unit.createdBy, userId))!);
  } else {
    unitConditions.push(eq(unit.visibility, "public"));
  }

  const units = await db.select().from(unit).where(and(...unitConditions));

  return {
    id: courseRow.id,
    title: courseRow.title,
    sourceLanguage: courseRow.sourceLanguage,
    targetLanguage: courseRow.targetLanguage,
    level: courseRow.level,
    visibility: courseRow.visibility,
    createdBy: courseRow.createdBy,
    units: units.map((item) => {
      const { lessons, parseError } = getUnitLessonsSafe(item.markdown);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        icon: item.icon,
        color: item.color,
        lessons,
        parseError,
      };
    }),
  };
}

export async function getAvailableFilters(db: Database, userId?: string) {
  const conditions = [eq(course.published, true)];
  if (userId) {
    conditions.push(or(eq(course.visibility, "public"), eq(course.createdBy, userId))!);
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

  return {
    sourceLanguages: [...new Set(rows.map((row) => row.sourceLanguage))].sort(),
    targetLanguages: [...new Set(rows.map((row) => row.targetLanguage))].sort(),
    levels: [...new Set(rows.map((row) => row.level))].sort(),
  };
}

export async function getStandaloneUnits(db: Database, userId: string): Promise<StandaloneUnitInfo[]> {
  const libraryRows = await db
    .select({ unitId: userUnitLibrary.unitId })
    .from(userUnitLibrary)
    .where(eq(userUnitLibrary.userId, userId));

  const libraryUnitIds = new Set(libraryRows.map((row) => row.unitId));

  const libraryCondition = libraryUnitIds.size > 0
    ? or(eq(unit.createdBy, userId), inArray(unit.id, [...libraryUnitIds]))
    : eq(unit.createdBy, userId);

  const rows = await db
    .select({
      id: unit.id,
      title: unit.title,
      description: unit.description,
      icon: unit.icon,
      color: unit.color,
      targetLanguage: unit.targetLanguage,
      sourceLanguage: unit.sourceLanguage,
      level: unit.level,
      markdown: unit.markdown,
      visibility: unit.visibility,
      createdBy: unit.createdBy,
      creatorName: user.name,
    })
    .from(unit)
    .leftJoin(user, eq(unit.createdBy, user.id))
    .where(and(isNull(unit.courseId), libraryCondition));

  if (rows.length === 0) return [];

  const unitIds = rows.map((row) => row.id);
  const completionCounts = await db
    .select({
      unitId: lessonCompletion.unitId,
      count: count(),
    })
    .from(lessonCompletion)
    .where(and(eq(lessonCompletion.userId, userId), inArray(lessonCompletion.unitId, unitIds)))
    .groupBy(lessonCompletion.unitId);

  const completionMap = new Map(completionCounts.map((entry) => [entry.unitId, Number(entry.count)]));

  return rows.map((item) => {
    const { lessons, parseError } = getUnitLessonsSafe(item.markdown);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      icon: item.icon,
      color: item.color,
      targetLanguage: item.targetLanguage,
      sourceLanguage: item.sourceLanguage,
      level: item.level,
      lessonCount: lessons.length,
      completedLessons: completionMap.get(item.id) ?? 0,
      visibility: item.visibility,
      creatorName: item.creatorName,
      isOwner: item.createdBy === userId,
      isInLibrary: libraryUnitIds.has(item.id),
      parseError,
    };
  });
}

export async function getBrowsableUnits(db: Database, userId: string): Promise<StandaloneUnitInfo[]> {
  const libraryRows = await db
    .select({ unitId: userUnitLibrary.unitId })
    .from(userUnitLibrary)
    .where(eq(userUnitLibrary.userId, userId));

  const libraryUnitIds = libraryRows.map((row) => row.unitId);

  const conditions = [
    isNull(unit.courseId),
    eq(unit.visibility, "public"),
    or(ne(unit.createdBy, userId), isNull(unit.createdBy)),
  ];

  if (libraryUnitIds.length > 0) {
    conditions.push(sql`${unit.id} NOT IN ${libraryUnitIds}`);
  }

  const rows = await db
    .select({
      id: unit.id,
      title: unit.title,
      description: unit.description,
      icon: unit.icon,
      color: unit.color,
      targetLanguage: unit.targetLanguage,
      sourceLanguage: unit.sourceLanguage,
      level: unit.level,
      markdown: unit.markdown,
      visibility: unit.visibility,
      createdBy: unit.createdBy,
      creatorName: user.name,
    })
    .from(unit)
    .leftJoin(user, eq(unit.createdBy, user.id))
    .where(and(...conditions));

  if (rows.length === 0) return [];

  return rows.map((item) => {
    const { lessons, parseError } = getUnitLessonsSafe(item.markdown);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      icon: item.icon,
      color: item.color,
      targetLanguage: item.targetLanguage,
      sourceLanguage: item.sourceLanguage,
      level: item.level,
      lessonCount: lessons.length,
      completedLessons: 0,
      visibility: item.visibility,
      creatorName: item.creatorName,
      isOwner: false,
      isInLibrary: false,
      parseError,
    };
  });
}

export async function getUnitForEdit(
  db: Database,
  unitId: string,
  userId: string,
  isAdmin = false,
): Promise<{ id: string; title: string; markdown: string; visibility: string | null } | null> {
  const [item] = await db
    .select({
      id: unit.id,
      title: unit.title,
      markdown: unit.markdown,
      createdBy: unit.createdBy,
      visibility: unit.visibility,
    })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!item) return null;
  if (isAdmin) {
    return {
      id: item.id,
      title: item.title,
      markdown: item.markdown,
      visibility: item.visibility,
    };
  }
  if (item.createdBy !== userId) return null;
  if (item.visibility === "public") return null;

  return {
    id: item.id,
    title: item.title,
    markdown: item.markdown,
    visibility: item.visibility,
  };
}

export async function getUnitWithContent(db: Database, unitId: string): Promise<UnitWithContent | null> {
  const [item] = await db.select().from(unit).where(eq(unit.id, unitId));
  if (!item) return null;

  const { lessons, parseError } = getUnitLessonsSafe(item.markdown);
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    icon: item.icon,
    color: item.color,
    targetLanguage: item.targetLanguage,
    sourceLanguage: item.sourceLanguage,
    level: item.level,
    courseId: item.courseId,
    visibility: item.visibility,
    createdBy: item.createdBy,
    lessons,
    parseError,
  };
}

export async function getUserOwnedCourses(db: Database, userId: string): Promise<OwnedCourseInfo[]> {
  const rows = await db
    .select({
      id: course.id,
      title: course.title,
      sourceLanguage: course.sourceLanguage,
      targetLanguage: course.targetLanguage,
      level: course.level,
      visibility: course.visibility,
      createdAt: course.createdAt,
      unitCount: countDistinct(unit.id),
    })
    .from(course)
    .leftJoin(unit, eq(unit.courseId, course.id))
    .where(eq(course.createdBy, userId))
    .groupBy(course.id)
    .orderBy(course.createdAt);

  if (rows.length === 0) return [];

  const courseIds = rows.map((row) => row.id);
  const completionCounts = await db
    .select({
      courseId: unit.courseId,
      count: count(),
    })
    .from(lessonCompletion)
    .innerJoin(unit, eq(unit.id, lessonCompletion.unitId))
    .where(and(eq(lessonCompletion.userId, userId), sql`${unit.courseId} IN ${courseIds}`))
    .groupBy(unit.courseId);

  const completionMap = new Map(completionCounts.map((entry) => [entry.courseId, Number(entry.count)]));

  const allUnits = await db
    .select({ id: unit.id, courseId: unit.courseId, markdown: unit.markdown })
    .from(unit)
    .where(sql`${unit.courseId} IN ${courseIds}`);

  const lessonCountMap = new Map<string, number>();
  for (const item of allUnits) {
    if (!item.courseId) continue;
    const { lessons } = getUnitLessonsSafe(item.markdown);
    lessonCountMap.set(item.courseId, (lessonCountMap.get(item.courseId) ?? 0) + lessons.length);
  }

  return rows.map((row) => ({
    ...row,
    unitCount: Number(row.unitCount),
    lessonCount: lessonCountMap.get(row.id) ?? 0,
    completedLessons: completionMap.get(row.id) ?? 0,
  }));
}

export async function getCourseForManagement(
  db: Database,
  courseId: string,
  userId: string,
  isAdmin: boolean,
): Promise<CourseManagementInfo | null> {
  const [courseRow] = await db
    .select({
      id: course.id,
      title: course.title,
      sourceLanguage: course.sourceLanguage,
      targetLanguage: course.targetLanguage,
      level: course.level,
      visibility: course.visibility,
      createdBy: course.createdBy,
    })
    .from(course)
    .where(eq(course.id, courseId));

  if (!courseRow) return null;
  if (courseRow.createdBy !== userId && !isAdmin) return null;

  const units = await db
    .select({
      id: unit.id,
      title: unit.title,
      icon: unit.icon,
      visibility: unit.visibility,
      markdown: unit.markdown,
    })
    .from(unit)
    .where(eq(unit.courseId, courseId));

  return {
    id: courseRow.id,
    title: courseRow.title,
    sourceLanguage: courseRow.sourceLanguage,
    targetLanguage: courseRow.targetLanguage,
    level: courseRow.level,
    visibility: courseRow.visibility,
    createdBy: courseRow.createdBy,
    units: units.map((item) => {
      const { lessons } = getUnitLessonsSafe(item.markdown);
      return {
        id: item.id,
        title: item.title,
        icon: item.icon,
        visibility: item.visibility,
        lessonCount: lessons.length,
      };
    }),
  };
}

export async function getUserOwnedStandaloneUnits(
  db: Database,
  userId: string,
): Promise<AvailableUnitForCourse[]> {
  const rows = await db
    .select({
      id: unit.id,
      title: unit.title,
      icon: unit.icon,
      targetLanguage: unit.targetLanguage,
      level: unit.level,
      markdown: unit.markdown,
    })
    .from(unit)
    .where(and(eq(unit.createdBy, userId), isNull(unit.courseId)));

  return rows.map((item) => {
    const { lessons } = getUnitLessonsSafe(item.markdown);
    return {
      id: item.id,
      title: item.title,
      icon: item.icon,
      targetLanguage: item.targetLanguage,
      level: item.level,
      lessonCount: lessons.length,
    };
  });
}
