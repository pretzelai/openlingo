import { and, eq } from "drizzle-orm";
import type { Database } from "../types";
import { course, unit, userStats, userUnitLibrary } from "../lib/db/schema";
import { parseUnitMarkdown } from "../../../../lib/content/unit-parser";
import { isAdminEmail } from "../../../../lib/ai/models";
import { getCourseForManagement, getUserOwnedStandaloneUnits } from "./courses";
import type { AvailableUnitForCourse, CourseManagementInfo } from "../../../../lib/content/types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function addUnitToLibrary(db: Database, userId: string, unitId: string) {
  const [existing] = await db
    .select({
      id: unit.id,
      visibility: unit.visibility,
      createdBy: unit.createdBy,
      courseId: unit.courseId,
    })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) return { success: false as const, error: "Unit not found" };
  if (existing.visibility !== "public") return { success: false as const, error: "Unit is not public" };
  if (existing.createdBy === userId) return { success: false as const, error: "You already own this unit" };

  await db.insert(userUnitLibrary).values({ userId, unitId }).onConflictDoNothing();
  return { success: true as const };
}

export async function removeUnitFromLibrary(db: Database, userId: string, unitId: string) {
  await db
    .delete(userUnitLibrary)
    .where(and(eq(userUnitLibrary.userId, userId), eq(userUnitLibrary.unitId, unitId)));

  return { success: true as const };
}

export async function updateUnitMarkdown(
  db: Database,
  userId: string,
  email: string | null | undefined,
  unitId: string,
  markdown: string,
): Promise<
  | { success: true; title: string; lessonCount: number; exerciseCount: number }
  | { success: false; error: string }
> {
  const admin = isAdminEmail(email);

  const [existing] = await db
    .select({ id: unit.id, createdBy: unit.createdBy, visibility: unit.visibility })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) return { success: false, error: "Unit not found" };
  if (existing.createdBy !== userId && !admin) return { success: false, error: "You do not own this unit" };
  if (existing.visibility === "public" && !admin) {
    return {
      success: false,
      error: "This unit is public and can no longer be edited. Only admins can make changes to public content.",
    };
  }

  const cleaned = markdown
    .replace(/^```(?:markdown|md)?\n/m, "")
    .replace(/\n```\s*$/, "")
    .trim();

  let parsedUnit;
  try {
    parsedUnit = parseUnitMarkdown(cleaned);
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse markdown: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (parsedUnit.lessons.length === 0) {
    return {
      success: false,
      error: "No lessons found. Make sure your markdown contains at least one lesson block with --- delimiters.",
    };
  }

  await db
    .update(unit)
    .set({
      title: parsedUnit.title,
      description: parsedUnit.description,
      icon: parsedUnit.icon,
      color: parsedUnit.color,
      markdown: cleaned,
      targetLanguage: parsedUnit.targetLanguage ?? "de",
      sourceLanguage: parsedUnit.sourceLanguage,
      level: parsedUnit.level,
      updatedAt: new Date(),
    })
    .where(eq(unit.id, unitId));

  const exerciseCount = parsedUnit.lessons.reduce((sum, lesson) => sum + lesson.exercises.length, 0);

  return {
    success: true,
    title: parsedUnit.title,
    lessonCount: parsedUnit.lessons.length,
    exerciseCount,
  };
}

export async function deleteUnitAction(
  db: Database,
  userId: string,
  email: string | null | undefined,
  unitId: string,
) {
  const admin = isAdminEmail(email);

  const [existing] = await db
    .select({ id: unit.id, createdBy: unit.createdBy, visibility: unit.visibility })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) return { success: false as const, error: "Unit not found" };
  if (existing.createdBy !== userId && !admin) return { success: false as const, error: "You do not own this unit" };
  if (existing.visibility === "public" && !admin) {
    return {
      success: false as const,
      error: "This unit is public and can no longer be deleted. Only admins can make changes to public content.",
    };
  }

  await db.delete(unit).where(eq(unit.id, unitId));
  return { success: true as const };
}

export async function makeUnitPublic(db: Database, userId: string, unitId: string) {
  const [existing] = await db
    .select({ id: unit.id, createdBy: unit.createdBy, visibility: unit.visibility })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) return { success: false as const, error: "Unit not found" };
  if (existing.createdBy !== userId) return { success: false as const, error: "You do not own this unit" };
  if (existing.visibility === "public") return { success: false as const, error: "Unit is already public" };

  await db.update(unit).set({ visibility: "public", updatedAt: new Date() }).where(eq(unit.id, unitId));
  return { success: true as const };
}

export async function makeUnitPrivate(
  db: Database,
  email: string | null | undefined,
  unitId: string,
) {
  if (!isAdminEmail(email)) {
    return { success: false as const, error: "Only admins can make units private" };
  }

  const [existing] = await db
    .select({ id: unit.id, visibility: unit.visibility })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) return { success: false as const, error: "Unit not found" };
  if (existing.visibility !== "public") return { success: false as const, error: "Unit is already private" };

  await db.update(unit).set({ visibility: null, updatedAt: new Date() }).where(eq(unit.id, unitId));
  return { success: true as const };
}

export async function makeCoursePublic(db: Database, userId: string, courseId: string) {
  const [existing] = await db
    .select({ id: course.id, createdBy: course.createdBy, visibility: course.visibility })
    .from(course)
    .where(eq(course.id, courseId));

  if (!existing) return { success: false as const, error: "Course not found" };
  if (existing.createdBy !== userId) return { success: false as const, error: "You do not own this course" };
  if (existing.visibility === "public") return { success: false as const, error: "Course is already public" };

  await db.update(course).set({ visibility: "public", updatedAt: new Date() }).where(eq(course.id, courseId));
  return { success: true as const };
}

export async function makeCoursePrivate(
  db: Database,
  email: string | null | undefined,
  courseId: string,
) {
  if (!isAdminEmail(email)) {
    return { success: false as const, error: "Only admins can make courses private" };
  }

  const [existing] = await db
    .select({ id: course.id, visibility: course.visibility })
    .from(course)
    .where(eq(course.id, courseId));

  if (!existing) return { success: false as const, error: "Course not found" };
  if (existing.visibility !== "public") return { success: false as const, error: "Course is already private" };

  await db.update(course).set({ visibility: null, updatedAt: new Date() }).where(eq(course.id, courseId));
  return { success: true as const };
}

export async function createCourseAction(
  db: Database,
  userId: string,
  data: { title: string; sourceLanguage: string; targetLanguage: string; level: string },
): Promise<{ success: true; courseId: string } | { success: false; error: string }> {
  if (!data.title.trim()) return { success: false, error: "Title is required" };
  if (!data.sourceLanguage) return { success: false, error: "Source language is required" };
  if (!data.targetLanguage) return { success: false, error: "Target language is required" };
  if (!data.level) return { success: false, error: "Level is required" };

  const slug = slugify(data.title);
  const suffix = crypto.randomUUID().slice(0, 8);
  const courseId = `${slug}-${suffix}`;

  await db.insert(course).values({
    id: courseId,
    title: data.title.trim(),
    sourceLanguage: data.sourceLanguage,
    targetLanguage: data.targetLanguage,
    level: data.level,
    visibility: null,
    published: true,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { success: true, courseId };
}

export async function deleteCourseAction(
  db: Database,
  userId: string,
  email: string | null | undefined,
  courseId: string,
) {
  const admin = isAdminEmail(email);

  const [existing] = await db
    .select({ id: course.id, createdBy: course.createdBy, visibility: course.visibility })
    .from(course)
    .where(eq(course.id, courseId));

  if (!existing) return { success: false as const, error: "Course not found" };
  if (existing.createdBy !== userId && !admin) return { success: false as const, error: "You do not own this course" };
  if (existing.visibility === "public" && !admin) {
    return {
      success: false as const,
      error: "This course is public and can no longer be deleted. Only admins can make changes to public content.",
    };
  }

  await db.update(unit).set({ courseId: null, updatedAt: new Date() }).where(eq(unit.courseId, courseId));
  await db.delete(course).where(eq(course.id, courseId));
  return { success: true as const };
}

export async function addUnitToCourse(
  db: Database,
  userId: string,
  email: string | null | undefined,
  unitId: string,
  courseId: string,
) {
  const admin = isAdminEmail(email);

  const [existingCourse] = await db
    .select({ id: course.id, createdBy: course.createdBy, visibility: course.visibility })
    .from(course)
    .where(eq(course.id, courseId));

  if (!existingCourse) return { success: false as const, error: "Course not found" };
  if (existingCourse.createdBy !== userId && !admin) return { success: false as const, error: "You do not own this course" };
  if (existingCourse.visibility === "public" && !admin) {
    return {
      success: false as const,
      error: "This course is public and can no longer be modified. Only admins can make changes to public content.",
    };
  }

  const [existingUnit] = await db
    .select({ id: unit.id, createdBy: unit.createdBy, courseId: unit.courseId })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existingUnit) return { success: false as const, error: "Unit not found" };
  if (existingUnit.createdBy !== userId && !admin) return { success: false as const, error: "You do not own this unit" };
  if (existingUnit.courseId) {
    return { success: false as const, error: "Unit is already assigned to a course. Remove it first." };
  }

  await db.update(unit).set({ courseId, updatedAt: new Date() }).where(eq(unit.id, unitId));
  return { success: true as const };
}

export async function removeUnitFromCourse(
  db: Database,
  userId: string,
  email: string | null | undefined,
  unitId: string,
) {
  const admin = isAdminEmail(email);

  const [existingUnit] = await db
    .select({ id: unit.id, createdBy: unit.createdBy, courseId: unit.courseId })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existingUnit) return { success: false as const, error: "Unit not found" };
  if (!existingUnit.courseId) return { success: false as const, error: "Unit is not in a course" };

  const [existingCourse] = await db
    .select({ id: course.id, createdBy: course.createdBy, visibility: course.visibility })
    .from(course)
    .where(eq(course.id, existingUnit.courseId));

  if (!existingCourse) return { success: false as const, error: "Course not found" };
  if (existingCourse.createdBy !== userId && !admin) return { success: false as const, error: "You do not own this course" };
  if (existingCourse.visibility === "public" && !admin) {
    return {
      success: false as const,
      error: "This course is public and can no longer be modified. Only admins can make changes to public content.",
    };
  }

  await db.update(unit).set({ courseId: null, updatedAt: new Date() }).where(eq(unit.id, unitId));
  return { success: true as const };
}

export async function fetchCourseManagementData(
  db: Database,
  userId: string,
  email: string | null | undefined,
  courseId: string,
): Promise<
  | { success: true; course: CourseManagementInfo; availableUnits: AvailableUnitForCourse[] }
  | { success: false; error: string }
> {
  const admin = isAdminEmail(email);
  const courseData = await getCourseForManagement(db, courseId, userId, admin);
  if (!courseData) {
    return { success: false, error: "Course not found or access denied" };
  }

  const availableUnits = await getUserOwnedStandaloneUnits(db, userId);
  return { success: true, course: courseData, availableUnits };
}

export async function ensureUserStatsRow(db: Database, userId: string) {
  await db.insert(userStats).values({ userId }).onConflictDoNothing();
}
