import { db } from "./index";
import {
  user,
  account,
  userStats,
  userCourseEnrollment,
  lessonCompletion,
  unit,
} from "./schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { UnitLesson } from "../content/types";

const TEST_USER_ID = "test-user-001";
const TEST_EMAIL = "test@example.com";
const COURSE_ID = "german";

export async function seedTestUser() {
  // 1. Create test user
  const now = new Date();
  await db
    .insert(user)
    .values({
      id: TEST_USER_ID,
      name: "Test User",
      email: TEST_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // 2. Create email/password account
  const PASSWORD = "honestly-i-think-i-am-a-potato";
  const passwordHash = await hashPassword(PASSWORD);
  await db
    .insert(account)
    .values({
      id: `account-${TEST_USER_ID}`,
      accountId: TEST_USER_ID,
      providerId: "credential",
      userId: TEST_USER_ID,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // 3. Create user stats
  await db
    .insert(userStats)
    .values({
      userId: TEST_USER_ID,
      currentStreak: 5,
      longestStreak: 5,
      lastPracticeDate: new Date().toISOString().split("T")[0],
      totalLessonsCompleted: 8,
      nativeLanguage: "en",
    })
    .onConflictDoNothing();

  // 4. Get units for the course
  const courseUnits = await db
    .select()
    .from(unit)
    .where(eq(unit.courseId, COURSE_ID));

  if (courseUnits.length === 0) {
    console.warn(
      `  No units found for course "${COURSE_ID}" — skipping enrollment`,
    );
    return;
  }

  // 5. Enroll in course — set current position to unit 2, lesson 0
  const currentUnit = courseUnits[2] ?? courseUnits[courseUnits.length - 1];
  await db
    .insert(userCourseEnrollment)
    .values({
      userId: TEST_USER_ID,
      courseId: COURSE_ID,
      currentUnitId: currentUnit.id,
      currentLessonIndex: 0,
    })
    .onConflictDoNothing();

  // 6. Complete all lessons in first 2 units
  let totalCompleted = 0;
  for (let ui = 0; ui < 2 && ui < courseUnits.length; ui++) {
    const u = courseUnits[ui];
    const lessons = u.exercises as UnitLesson[];

    for (let li = 0; li < lessons.length; li++) {
      const lesson = lessons[li];
      const perfect = Math.random() > 0.3;

      await db
        .insert(lessonCompletion)
        .values({
          id: `completion-${u.id}-${li}`,
          userId: TEST_USER_ID,
          unitId: u.id,
          lessonIndex: li,
          perfectScore: perfect,
        })
        .onConflictDoNothing();

      totalCompleted++;
    }
  }

  console.log(
    `  ${TEST_EMAIL} / ${PASSWORD} — ${totalCompleted} lessons completed, current: ${currentUnit.title}`,
  );
}
