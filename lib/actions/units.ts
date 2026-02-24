"use server";

import { db } from "@/lib/db";
import { unit } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { parseUnitMarkdown } from "@/lib/content/unit-parser";
import { revalidatePath } from "next/cache";

export async function updateUnitMarkdown(
  unitId: string,
  markdown: string
): Promise<
  | { success: true; title: string; lessonCount: number; exerciseCount: number }
  | { success: false; error: string }
> {
  const session = await requireSession();
  const userId = session.user.id;

  // Fetch unit and verify ownership
  const [existing] = await db
    .select({ id: unit.id, createdBy: unit.createdBy })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) {
    return { success: false, error: "Unit not found" };
  }

  if (existing.createdBy !== userId) {
    return { success: false, error: "You do not own this unit" };
  }

  // Strip code fences (same logic as createUnit tool)
  const cleaned = markdown
    .replace(/^```(?:markdown|md)?\n/m, "")
    .replace(/\n```\s*$/, "")
    .trim();

  // Parse and validate
  let parsedUnit;
  try {
    parsedUnit = parseUnitMarkdown(cleaned);
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse markdown: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (parsedUnit.lessons.length === 0) {
    return {
      success: false,
      error: "No lessons found. Make sure your markdown contains at least one lesson block with --- delimiters.",
    };
  }

  // Update all denormalized fields + markdown
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

  const exerciseCount = parsedUnit.lessons.reduce(
    (sum, l) => sum + l.exercises.length,
    0
  );

  revalidatePath("/units", "page");

  return {
    success: true,
    title: parsedUnit.title,
    lessonCount: parsedUnit.lessons.length,
    exerciseCount,
  };
}

export async function deleteUnit(
  unitId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await requireSession();
  const userId = session.user.id;

  // Fetch unit and verify ownership
  const [existing] = await db
    .select({ id: unit.id, createdBy: unit.createdBy })
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!existing) {
    return { success: false, error: "Unit not found" };
  }

  if (existing.createdBy !== userId) {
    return { success: false, error: "You do not own this unit" };
  }

  await db.delete(unit).where(eq(unit.id, unitId));

  revalidatePath("/units", "page");

  return { success: true };
}
