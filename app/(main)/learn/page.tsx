import { getAllCourses } from "@/lib/content/registry";
import { getUserProgress } from "@/lib/actions/progress";
import { LearningPath } from "./learning-path";

export const metadata = { title: "Learn — LingoClaw" };

export default async function LearnPage() {
  const courses = getAllCourses();
  const course = courses[0]; // Default to first course

  if (!course) {
    return (
      <div className="mx-auto max-w-lg text-center py-20">
        <p className="text-lg text-lingo-text-light">No courses available yet.</p>
      </div>
    );
  }

  const progress = await getUserProgress(course.id);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lingo-text">{course.title}</h1>
        <p className="text-sm text-lingo-text-light mt-1">
          {course.sourceLanguage.toUpperCase()} → {course.targetLanguage.toUpperCase()}
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
