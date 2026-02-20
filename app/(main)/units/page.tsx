import Link from "next/link";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  listCoursesWithLessonCounts,
  getAvailableFilters,
  getUserEnrolledCourses,
  getStandaloneUnits,
} from "@/lib/db/queries/courses";
import { getNativeLanguage } from "@/lib/actions/profile";
import { ContinueLearning } from "./continue-learning";
import { StandaloneUnits } from "./standalone-units";
import { CourseBrowser } from "./course-browser";

const NEW_UNIT_PROMPT = "I want to create a new personalised unit";


export default async function LearnPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  const nativeLanguage = userId ? await getNativeLanguage(userId) : null;

  const [courses, filters, enrolled, standaloneUnits] = await Promise.all([
    listCoursesWithLessonCounts(
      nativeLanguage ? { sourceLanguage: nativeLanguage } : undefined,
    ),
    getAvailableFilters(),
    userId ? getUserEnrolledCourses(userId) : Promise.resolve([]),
    userId ? getStandaloneUnits(userId) : Promise.resolve([]),
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
    <div className="mx-auto w-full max-w-2xl overflow-x-hidden">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lingo-text">Learn</h1>
      </div>
      <div className="mb-6 flex gap-2 justify-center">
        <Link
          href={`/chat?prompt=${encodeURIComponent(NEW_UNIT_PROMPT)}`}
          className="rounded-xl border-2 border-lingo-border bg-white px-4 py-2.5 text-sm font-bold text-lingo-text shadow-[0_2px_0_0] shadow-lingo-border transition-all hover:border-lingo-green hover:bg-lingo-green/5 active:translate-y-[1px] active:shadow-none"
        >
          + New Unit
        </Link>
      </div>
      <ContinueLearning courses={enrolled} />
      <StandaloneUnits units={standaloneUnits} />
      {courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-lg text-lingo-text-light mb-2">
            No courses available for your language yet.
          </p>
          <p className="text-sm text-lingo-text-light">
            Change your native language in{" "}
            <a href="/settings" className="font-bold text-lingo-blue underline">
              settings
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
