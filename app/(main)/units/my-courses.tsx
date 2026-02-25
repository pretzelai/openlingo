"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OwnedCourseInfo } from "@/lib/content/types";
import type { AvailableUnitForCourse, CourseManagementInfo } from "@/lib/content/types";
import { getLanguageName } from "@/lib/languages";
import { makeCoursePublic, makeCoursePrivate, deleteCourse } from "@/lib/actions/units";
import { CreateCourseForm } from "./create-course-form";
import { CourseManager } from "./course-manager";
import { CopyLinkButton } from "@/components/ui/copy-link-button";

interface MyCoursesProps {
  courses: OwnedCourseInfo[];
  isAdmin?: boolean;
  /** Data needed when a course is expanded for management */
  managementData?: {
    courseId: string;
    course: CourseManagementInfo;
    availableUnits: AvailableUnitForCourse[];
  } | null;
}

export function MyCourses({ courses, isAdmin }: MyCoursesProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [managingCourseId, setManagingCourseId] = useState<string | null>(null);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-lingo-text">My Courses</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-xl border-2 border-lingo-border bg-white px-3 py-1.5 text-xs font-bold text-lingo-text shadow-[0_2px_0_0] shadow-lingo-border transition-all hover:border-lingo-green hover:bg-lingo-green/5 active:translate-y-[1px] active:shadow-none"
        >
          + New Course
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-4">
          <CreateCourseForm onClose={() => setShowCreateForm(false)} />
        </div>
      )}

      {courses.length === 0 && !showCreateForm ? (
        <p className="py-4 text-center text-sm text-lingo-text-light">
          You haven&apos;t created any courses yet.
        </p>
      ) : (
        <div className="grid min-w-0 gap-3">
          {courses.map((c) => (
            <OwnedCourseCard
              key={c.id}
              course={c}
              isAdmin={isAdmin}
              isManaging={managingCourseId === c.id}
              onToggleManage={() =>
                setManagingCourseId(managingCourseId === c.id ? null : c.id)
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OwnedCourseCard({
  course,
  isAdmin,
  isManaging,
  onToggleManage,
}: {
  course: OwnedCourseInfo;
  isAdmin?: boolean;
  isManaging: boolean;
  onToggleManage: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<
    null | "make-public" | "make-private" | "delete"
  >(null);
  const isPublic = course.visibility === "public";
  const isLocked = isPublic && !isAdmin;
  const isActionPending = isPending || activeAction !== null;

  function handleMakePublic() {
    const confirmed = window.confirm(
      "Are you sure you want to make this course public?\n\n" +
        "Once public, this course cannot be edited anymore. " +
        "Only admins can make changes to public content. " +
        "All users will have access to this course."
    );
    if (!confirmed) return;

    setActiveAction("make-public");
    startTransition(async () => {
      try {
        const result = await makeCoursePublic(course.id);
        if (result.success) {
          router.refresh();
        } else {
          alert(result.error);
        }
      } finally {
        setActiveAction(null);
      }
    });
  }

  function handleMakePrivate() {
    setActiveAction("make-private");
    startTransition(async () => {
      try {
        const result = await makeCoursePrivate(course.id);
        if (result.success) {
          router.refresh();
        } else {
          alert(result.error);
        }
      } finally {
        setActiveAction(null);
      }
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this course?\n\n" +
        "The units in this course will NOT be deleted — they will become standalone units. " +
        "This action cannot be undone."
    );
    if (!confirmed) return;

    setActiveAction("delete");
    startTransition(async () => {
      try {
        const result = await deleteCourse(course.id);
        if (result.success) {
          router.refresh();
        } else {
          alert(result.error);
        }
      } finally {
        setActiveAction(null);
      }
    });
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border-2 border-lingo-border bg-white shadow-[0_2px_0_0] shadow-lingo-border hover:border-lingo-blue transition-all">
      <Link href={`/units/${course.id}`} className="block">
        <div className="flex min-w-0 items-center gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lingo-blue/10 text-2xl">
            📘
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-lingo-text truncate">{course.title}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  isPublic
                    ? "bg-lingo-green/15 text-lingo-green"
                    : "bg-lingo-gray text-lingo-text-light"
                }`}
              >
                {isPublic ? "Public" : "Private"}
              </span>
            </div>
            <p className="text-sm text-lingo-text-light">
              {getLanguageName(course.sourceLanguage)} →{" "}
              {getLanguageName(course.targetLanguage)}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-lingo-text-light">
              <span>{course.level}</span>
              <span>·</span>
              <span>
                {course.unitCount} {course.unitCount === 1 ? "unit" : "units"}
              </span>
              {course.lessonCount > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {course.lessonCount} {course.lessonCount === 1 ? "lesson" : "lessons"}
                  </span>
                </>
              )}
            </div>
            {/* Progress bar */}
            {course.lessonCount > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="h-2 flex-1 rounded-full bg-lingo-gray overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lingo-blue transition-all duration-500"
                    style={{
                      width: `${Math.round((course.completedLessons / course.lessonCount) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-bold text-lingo-blue whitespace-nowrap">
                  {course.completedLessons}/{course.lessonCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Actions bar */}
      <div className="border-t border-lingo-border px-4 py-2 flex flex-wrap items-center gap-2">
        {isPublic && <CopyLinkButton path={`/units/${course.id}`} />}
        {!isLocked && (
          <button
            onClick={onToggleManage}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-lingo-blue hover:bg-lingo-blue/10 transition-colors"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
              />
            </svg>
            {isManaging ? "Close" : "Manage"}
          </button>
        )}

        {!isPublic && (
          <button
            onClick={handleMakePublic}
            disabled={isActionPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-lingo-green hover:bg-lingo-green/10 transition-colors disabled:opacity-50"
          >
            {activeAction === "make-public" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-lingo-green/30 border-t-lingo-green" />
                Making Public...
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                  />
                </svg>
                Make Public
              </>
            )}
          </button>
        )}

        {/* Admin: Make Private button */}
        {isAdmin && isPublic && (
          <button
            onClick={handleMakePrivate}
            disabled={isActionPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {activeAction === "make-private" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
                Making Private...
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                Make Private
              </>
            )}
          </button>
        )}

        {!isLocked && (
          <button
            onClick={handleDelete}
            disabled={isActionPending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {activeAction === "delete" ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500/30 border-t-red-500" />
                Deleting...
              </>
            ) : (
              <>
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                  />
                </svg>
                Delete
              </>
            )}
          </button>
        )}

        {isLocked && (
          <span className="text-xs text-lingo-text-light italic">
            Public — read-only
          </span>
        )}
      </div>

      {/* Expanded management panel */}
      {isManaging && !isLocked && (
        <div className="border-t border-lingo-border">
          <CourseManager courseId={course.id} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}
