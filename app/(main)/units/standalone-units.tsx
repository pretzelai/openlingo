"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { StandaloneUnitInfo } from "@/lib/content/types";
import { getLanguageName } from "@/lib/languages";
import { getUnitColor } from "@/lib/colors";
import { makeUnitPublic, makeUnitPrivate, deleteUnit } from "@/lib/actions/units";
import { removeUnitFromLibrary } from "@/lib/actions/library";
import { CopyLinkButton } from "@/components/ui/copy-link-button";

interface StandaloneUnitsProps {
  units: StandaloneUnitInfo[];
  isAdmin?: boolean;
}

export function StandaloneUnits({ units, isAdmin }: StandaloneUnitsProps) {
  if (units.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold text-lingo-text">My Units</h2>
      <div className="grid min-w-0 gap-3">
        {units.map((unit, i) => (
          <StandaloneUnitCard
            key={unit.id}
            unit={unit}
            index={i}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </section>
  );
}

function StandaloneUnitCard({
  unit,
  index,
  isAdmin,
}: {
  unit: StandaloneUnitInfo;
  index: number;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<
    null | "make-public" | "make-private" | "delete" | "remove"
  >(null);
  const color = getUnitColor(index);
  const progress =
    unit.lessonCount > 0
      ? (unit.completedLessons / unit.lessonCount) * 100
      : 0;
  const isPublic = unit.visibility === "public";
  const hasParseError = unit.parseError === true;

  const isEditLocked = isPublic && !isAdmin;
  const isActionPending = isPending || activeAction !== null;

  function handleMakePublic() {
    const confirmed = window.confirm(
      "Are you sure you want to make this unit public?\n\n" +
        "Once public, this unit cannot be edited anymore. " +
        "Only admins can make changes to public content. " +
        "All users will have access to this unit and your name will be shown as the author."
    );
    if (!confirmed) return;

    setActiveAction("make-public");
    startTransition(async () => {
      try {
        const result = await makeUnitPublic(unit.id);
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
        const result = await makeUnitPrivate(unit.id);
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

  function handleRemoveFromLibrary() {
    setActiveAction("remove");
    startTransition(async () => {
      try {
        const result = await removeUnitFromLibrary(unit.id);
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
      "Are you sure you want to delete this unit?\n\n" +
        "This action cannot be undone."
    );
    if (!confirmed) return;

    setActiveAction("delete");
    startTransition(async () => {
      try {
        const result = await deleteUnit(unit.id);
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

  const cardContent = (
    <div
      className={`flex min-w-0 items-center gap-3 p-4${hasParseError ? " opacity-60" : ""}`}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{ backgroundColor: `${color}20` }}
      >
        {unit.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-lingo-text truncate">{unit.title}</p>
          {hasParseError && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
              Can&apos;t be parsed
            </span>
          )}
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
        <p className="text-sm text-lingo-text-light truncate">
          {unit.description}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-lingo-text-light">
          <span>{getLanguageName(unit.targetLanguage)}</span>
          {unit.level && (
            <>
              <span>·</span>
              <span>{unit.level}</span>
            </>
          )}
          {!hasParseError && (
            <>
              <span>·</span>
              <span>
                {unit.lessonCount}{" "}
                {unit.lessonCount === 1 ? "lesson" : "lessons"}
              </span>
            </>
          )}
          {unit.creatorName && (
            <>
              <span>·</span>
              <span className="truncate">by {unit.creatorName}</span>
            </>
          )}
        </div>
        {/* Progress bar — hide for broken units */}
        {!hasParseError && (
          <div className="flex items-center gap-2 mt-2">
            <div className="h-2 flex-1 rounded-full bg-lingo-gray overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span
              className="text-xs font-bold whitespace-nowrap"
              style={{ color }}
            >
              {unit.completedLessons}/{unit.lessonCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  const showActions =
    unit.isOwner || (isAdmin && isPublic) || (!unit.isOwner && unit.isInLibrary);

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border-2 shadow-[0_2px_0_0] transition-all ${
        hasParseError
          ? "border-red-200 bg-white shadow-red-200 cursor-not-allowed"
          : "border-lingo-border bg-white shadow-lingo-border hover:border-lingo-green hover:bg-lingo-green/5"
      }`}
    >
      {hasParseError ? (
        cardContent
      ) : (
        <Link href={`/unit/${unit.id}`} className="block">
          {cardContent}
        </Link>
      )}
      {showActions && (
        <div className="border-t border-lingo-border px-4 py-2 flex flex-wrap items-center gap-2">
          {isPublic && <CopyLinkButton path={`/unit/${unit.id}`} />}
          {unit.isOwner && (
            <>
              {/* Edit Markdown: shown if private, or if admin (even if public) */}
              {(!isPublic || isAdmin) && (
                <Link
                  href={`/units/edit/${unit.id}`}
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
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                    />
                  </svg>
                  Edit Markdown
                </Link>
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
              {!isEditLocked && (
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
              {/* Owner of public unit, not admin: show read-only indicator */}
              {isEditLocked && (
                <span className="text-xs text-lingo-text-light italic">
                  Public — read-only
                </span>
              )}
            </>
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
          {/* Non-owner library units: Remove button */}
          {!unit.isOwner && unit.isInLibrary && (
            <button
              onClick={handleRemoveFromLibrary}
              disabled={isActionPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-lingo-text-light hover:bg-lingo-gray/50 transition-colors disabled:opacity-50"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
