export default function LearnLoading() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 text-center">
        <div className="mx-auto h-8 w-48 animate-pulse rounded-lg bg-lingo-gray" />
        <div className="mx-auto mt-2 h-4 w-24 animate-pulse rounded-lg bg-lingo-gray" />
      </div>
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="h-12 w-12 animate-pulse rounded-xl bg-lingo-gray" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 animate-pulse rounded bg-lingo-gray" />
                <div className="h-3 w-48 animate-pulse rounded bg-lingo-gray" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 py-4">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-16 w-16 animate-pulse rounded-full bg-lingo-gray" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
