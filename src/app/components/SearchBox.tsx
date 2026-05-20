"use client";

import { useEffect, useState } from "react";
import { TmdbSuggestion } from "./types";

const IMG = (path: string) => `https://image.tmdb.org/t/p/w185${path}`;

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function SearchBox({
  onPick,
  disabled = false,
}: {
  onPick: (s: TmdbSuggestion) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [results, setResults] = useState<TmdbSuggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const q = debounced.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const r = await fetch(`/api/tmdb/search?type=multi&query=${encodeURIComponent(q)}`);
      const data = await r.json();
      if (!cancelled) setResults(data?.results ?? []);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search a movie or TV show"
        disabled={disabled}
        className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
      />

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-2 max-h-90 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.map((s) => (
            <button
              key={`${s.media_type}-${s.id}`}
              type="button"
              className="w-full px-3 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
              onClick={() => {
                onPick(s);
                setQuery(s.title);
                setOpen(false);
              }}
            >
              <div className="h-12 w-9 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0">
                {s.poster_path ? <img src={IMG(s.poster_path)} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {s.title}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    {s.year ? `(${s.year})` : ""} · {s.media_type.toUpperCase()}
                    {typeof s.vote_average === "number" ? ` · ★ ${s.vote_average.toFixed(1)}` : ""}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
