"use client";

import { useEffect, useState } from "react";
import { Pin, TmdbDetails } from "./types";

const IMG_BACKDROP = (path: string) => `https://image.tmdb.org/t/p/w780${path}`;
const IMG_POSTER = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

export function SidePanel({
  pin,
  saved,
  onClose,
  onToggleSave,
}: {
  pin: Pin;
  saved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}) {
  const [details, setDetails] = useState<TmdbDetails | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const r = await fetch(`/api/tmdb/details?type=${pin.contentType}&id=${pin.tmdbId}`);
      const data = await r.json();
      if (!cancelled) setDetails(data);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [pin.tmdbId, pin.contentType]);

  const hero =
    details?.images?.backdrops?.[0]
      ? IMG_BACKDROP(details.images.backdrops[0])
      : details?.images?.posters?.[0]
      ? IMG_BACKDROP(details.images.posters[0])
      : null;

  return (
    <div className="h-full w-full bg-white border-l border-gray-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="text-sm font-semibold text-gray-900 truncate">{pin.title}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <div className="h-[calc(100%-56px)] overflow-y-auto">
        {hero ? (
          <div className="px-4 pt-4">
            <img src={hero} className="h-42.5 w-full rounded-2xl object-cover border border-gray-200" alt="" />
          </div>
        ) : null}

        <div className="px-4 pt-4">
          <div className="text-2xl font-bold text-gray-900">{details?.title ?? pin.title}</div>
          <div className="mt-1 text-sm text-gray-600">
            {pin.contentType.toUpperCase()}
            {details?.year ? ` · ${details.year}` : ""}
            {details?.vote_average != null ? ` · ★ ${details.vote_average.toFixed(1)}` : ""}
          </div>

          <div className="mt-3 text-sm text-gray-700">{pin.locationName}</div>

          {details?.overview ? (
            <p className="mt-3 text-sm text-gray-600 leading-6">{details.overview}</p>
          ) : null}

          {details?.genres?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {details.genres.map((g) => (
                <span key={g} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                  {g}
                </span>
              ))}
            </div>
          ) : null}

          {/* “More images” */}
          {details?.images?.posters?.length ? (
            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-900">More images</div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                {details.images.posters.slice(0, 8).map((p) => (
                  <img
                    key={p}
                    src={IMG_POSTER(p)}
                    alt=""
                    className="h-24 w-16 rounded-xl border border-gray-200 object-cover shrink-0"
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex gap-3 pb-8">
            <button
              type="button"
              onClick={onToggleSave}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                saved ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              {saved ? "Saved ⭐" : "Save"}
            </button>

            <button
              type="button"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pin.lat},${pin.lng}`)}`,
                  "_blank"
                )
              }
              className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Open in Maps
            </button>
          </div>

          <div className="text-xs text-gray-400 pb-6">Uses TMDB API (not endorsed by TMDB).</div>
        </div>
      </div>
    </div>
  );
}
