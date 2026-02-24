"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateUnitMarkdown, deleteUnit } from "@/lib/actions/units";

interface UnitEditorProps {
  unitId: string;
  title: string;
  initialMarkdown: string;
}

export function UnitEditor({ unitId, title, initialMarkdown }: UnitEditorProps) {
  const router = useRouter();
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const hasChanges = markdown !== initialMarkdown;

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await updateUnitMarkdown(unitId, markdown);
      if (result.success) {
        router.push("/units");
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this unit? This cannot be undone.")) {
      return;
    }
    setError(null);
    startDeleting(async () => {
      const result = await deleteUnit(unitId);
      if (result.success) {
        router.push("/units");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/units"
            className="shrink-0 text-sm font-bold text-lingo-text-light hover:text-lingo-text transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-bold text-lingo-text truncate">
            Edit: {title}
          </h1>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-xl border-2 border-lingo-red/30 bg-lingo-red/5 px-4 py-3">
          <p className="text-sm font-medium text-lingo-red">{error}</p>
        </div>
      )}

      {/* Editor */}
      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        spellCheck={false}
        className="w-full flex-1 rounded-xl border-2 border-lingo-border bg-white px-4 py-3 font-mono text-sm text-lingo-text leading-relaxed placeholder:text-lingo-gray-dark focus:border-lingo-blue focus:outline-none transition-colors resize-none"
        style={{ minHeight: "calc(100vh - 260px)" }}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasChanges || isDeleting}
          >
            Save
          </Button>
          <Link href="/units">
            <Button variant="outline" disabled={isSaving || isDeleting}>
              Cancel
            </Button>
          </Link>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          loading={isDeleting}
          disabled={isSaving}
        >
          Delete Unit
        </Button>
      </div>
    </div>
  );
}
