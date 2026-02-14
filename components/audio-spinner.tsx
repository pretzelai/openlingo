export function AudioSpinner({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-lingo-blue border-t-transparent" />
      <span className="text-sm text-lingo-text-light">Generating audio…</span>
    </div>
  );
}
