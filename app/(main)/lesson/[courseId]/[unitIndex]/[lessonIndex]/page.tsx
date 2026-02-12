import { getCourseWithContent } from "@/lib/db/queries/courses";
import { notFound } from "next/navigation";
import { LessonView } from "./lesson-view";

interface PageProps {
  params: Promise<{ courseId: string; unitIndex: string; lessonIndex: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { courseId, unitIndex, lessonIndex } = await params;
  const course = await getCourseWithContent(courseId);
  if (!course) return { title: "Lesson — LingoClaw" };

  const unit = course.units[parseInt(unitIndex)];
  const lesson = unit?.lessons[parseInt(lessonIndex)];
  return { title: `${lesson?.title ?? "Lesson"} — LingoClaw` };
}

export default async function LessonPage({ params }: PageProps) {
  const { courseId, unitIndex, lessonIndex } = await params;
  const course = await getCourseWithContent(courseId);
  if (!course) notFound();

  const ui = parseInt(unitIndex);
  const li = parseInt(lessonIndex);
  const unit = course.units[ui];
  if (!unit) notFound();
  const lesson = unit.lessons[li];
  if (!lesson) notFound();

  return (
    <LessonView
      courseId={courseId}
      unitIndex={ui}
      lessonIndex={li}
      lesson={lesson}
      lessonTitle={lesson.title}
      unitTitle={unit.title}
      targetLanguage={course.targetLanguage}
    />
  );
}
