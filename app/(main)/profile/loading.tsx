export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl bg-white border-2 border-lingo-border p-6 text-center">
        <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-lingo-gray" />
        <div className="mx-auto mt-3 h-7 w-32 animate-pulse rounded bg-lingo-gray" />
        <div className="mx-auto mt-2 h-4 w-40 animate-pulse rounded bg-lingo-gray" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border-2 border-lingo-border p-6"
          >
            <div className="mx-auto h-8 w-16 animate-pulse rounded bg-lingo-gray" />
            <div className="mx-auto mt-2 h-3 w-12 animate-pulse rounded bg-lingo-gray" />
          </div>
        ))}
      </div>
    </div>
  );
}
