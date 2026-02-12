import { notFound } from "next/navigation";
import { getCourseWithContent } from "@/lib/db/queries/courses";
import { getUserProgress } from "@/lib/actions/progress";
import { LearningPath } from "../learning-path";
import { HoverableText } from "@/components/word/hoverable-text";
import { getLanguageName } from "@/lib/languages";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { courseId } = await params;
  const course = await getCourseWithContent(courseId);
  if (!course) return { title: "Course — LingoClaw" };
  return { title: `${course.title} — LingoClaw` };
}

export default async function CourseDetailPage({ params }: PageProps) {
  const { courseId } = await params;
  const course = await getCourseWithContent(courseId);
  if (!course) notFound();

  const progress = await getUserProgress(course.id);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lingo-text"><HoverableText text={course.title} language={course.targetLanguage} /></h1>
        <p className="text-sm text-lingo-text-light mt-1">
          {getLanguageName(course.sourceLanguage)} →{" "}
          {getLanguageName(course.targetLanguage)}
        </p>
      </div>
      <LearningPath
        course={course}
        enrollment={progress.enrollment}
        completions={progress.completions}
      />
    </div>
  );
}
