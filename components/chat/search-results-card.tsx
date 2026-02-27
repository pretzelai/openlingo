"use client";

interface SearchResult {
  title: string;
  url: string;
  publishedDate: string | null;
  author: string | null;
  summary: string | null;
  highlights: string[];
}

interface SearchResultsCardProps {
  query: string;
  results: SearchResult[];
}

export function SearchResultsCard({ query, results }: SearchResultsCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border-2 border-lingo-border bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-lingo-border/50 px-4 py-3">
        <svg
          className="h-5 w-5 shrink-0 text-lingo-blue"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-lingo-text">
            {query}
          </h3>
          <p className="text-[11px] text-lingo-text-light">
            {results.length} result{results.length !== 1 ? "s" : ""} found
          </p>
        </div>
      </div>

      {/* Results list */}
      <div className="divide-y divide-lingo-border/30">
        {results.map((result, i) => {
          const domain = (() => {
            try {
              return new URL(result.url).hostname.replace("www.", "");
            } catch {
              return result.url;
            }
          })();

          const formattedDate = result.publishedDate
            ? (() => {
                try {
                  return new Date(result.publishedDate).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  );
                } catch {
                  return null;
                }
              })()
            : null;

          return (
            <a
              key={`${result.url}-${i}`}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 transition-colors hover:bg-lingo-gray/30"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-lingo-text leading-snug">
                    {result.title}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-lingo-text-light">
                    <span>{domain}</span>
                    {formattedDate && (
                      <>
                        <span className="text-lingo-border">·</span>
                        <span>{formattedDate}</span>
                      </>
                    )}
                    {result.author && (
                      <>
                        <span className="text-lingo-border">·</span>
                        <span className="truncate max-w-[200px]">
                          {result.author}
                        </span>
                      </>
                    )}
                  </div>
                  {result.summary && (
                    <p className="mt-1.5 text-xs leading-relaxed text-lingo-text-light line-clamp-2">
                      {result.summary}
                    </p>
                  )}
                </div>
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-lingo-text-light"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
