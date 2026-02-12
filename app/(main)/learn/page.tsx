import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  listCourses,
  getAvailableFilters,
  getUserEnrolledCourses,
} from "@/lib/db/queries/courses";
import { getNativeLanguage } from "@/lib/actions/profile";
import { ContinueLearning } from "./continue-learning";
import { CourseBrowser } from "./course-browser";

export const metadata = { title: "Learn — LingoClaw" };

export default async function LearnPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const nativeLanguage = userId ? await getNativeLanguage(userId) : null;

  const [courses, filters, enrolled] = await Promise.all([
    listCourses(nativeLanguage ? { sourceLanguage: nativeLanguage } : undefined),
    getAvailableFilters(),
    userId ? getUserEnrolledCourses(userId) : Promise.resolve([]),
  ]);

  if (courses.length === 0 && !nativeLanguage) {
    return (
      <div className="mx-auto max-w-2xl text-center py-20">
        <p className="text-lg text-lingo-text-light">
          No courses available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lingo-text">Learn</h1>
      </div>
      <ContinueLearning courses={enrolled} />
      {courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-lingo-text-light mb-2">
            No courses available for your language yet.
          </p>
          <p className="text-sm text-lingo-text-light">
            Change your native language in your{" "}
            <a href="/profile" className="font-bold text-lingo-blue underline">
              profile
            </a>{" "}
            to see more courses.
          </p>
        </div>
      ) : (
        <CourseBrowser courses={courses} filters={filters} />
      )}
    </div>
  );
}
