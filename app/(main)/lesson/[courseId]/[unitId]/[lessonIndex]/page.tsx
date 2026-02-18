import { getCourseWithContent } from "@/lib/db/queries/courses";
import { notFound } from "next/navigation";
import { LessonView } from "./lesson-view";

interface PageProps {
  params: Promise<{ courseId: string; unitId: string; lessonIndex: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { courseId, unitId, lessonIndex } = await params;
  const course = await getCourseWithContent(courseId);
  if (!course) return { title: "Lesson — ClaudeLingo" };

  const unit = course.units.find((u) => u.id === unitId);
  const lesson = unit?.lessons[parseInt(lessonIndex)];
  return { title: `${lesson?.title ?? "Lesson"} — ClaudeLingo` };
}

export default async function LessonPage({ params }: PageProps) {
  const { courseId, unitId, lessonIndex } = await params;
  const course = await getCourseWithContent(courseId);
  if (!course) notFound();

  const li = parseInt(lessonIndex);
  const unit = course.units.find((u) => u.id === unitId);
  if (!unit) notFound();
  const lesson = unit.lessons[li];
  if (!lesson) notFound();

  return (
    <LessonView
      courseId={courseId}
      unitId={unitId}
      lessonIndex={li}
      lesson={lesson}
      lessonTitle={lesson.title}
      unitTitle={unit.title}
      targetLanguage={course.targetLanguage}
    />
  );
}
