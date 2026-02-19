import { getUnitWithContent } from "@/lib/db/queries/courses";
import { notFound, redirect } from "next/navigation";
import { LessonView } from "@/app/(main)/lesson/[courseId]/[unitId]/[lessonIndex]/lesson-view";

interface PageProps {
  params: Promise<{ unitId: string; lessonIndex: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { unitId, lessonIndex } = await params;
  const unit = await getUnitWithContent(unitId);
  if (!unit) return { title: "Lesson — ClaudeLingo" };

  const lesson = unit.lessons[parseInt(lessonIndex)];
  return { title: `${lesson?.title ?? "Lesson"} — ClaudeLingo` };
}

export default async function StandaloneLessonPage({ params }: PageProps) {
  const { unitId, lessonIndex } = await params;
  const unit = await getUnitWithContent(unitId);
  if (!unit) notFound();

  // If unit belongs to a course, redirect to course lesson route
  if (unit.courseId) {
    redirect(`/lesson/${unit.courseId}/${unitId}/${lessonIndex}`);
  }

  const li = parseInt(lessonIndex);
  const lesson = unit.lessons[li];
  if (!lesson) notFound();

  return (
    <LessonView
      unitId={unitId}
      lessonIndex={li}
      lesson={lesson}
      lessonTitle={lesson.title}
      unitTitle={unit.title}
      targetLanguage={unit.targetLanguage}
    />
  );
}
