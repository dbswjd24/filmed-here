"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { SearchBox } from "./components/SearchBox";

const MapView = dynamic(() => import("./components/MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100" />,
});
import { SidePanel } from "./components/SidePanel";
import { Pin, TmdbSuggestion } from "./components/types";
import { loadPins, loadSavedIds, savePins, saveSavedIds } from "./components/storage";

function makeId() {
  return `pin_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

type WikiSpot = {
  id: string;
  locationName: string;
  lat: number;
  lng: number;
  works: string;
};

async function fetchWikidataSpots(mode: string, params: Record<string, string>): Promise<WikiSpot[]> {
  const qs = new URLSearchParams({ mode, ...params }).toString();
  const r = await fetch(`/api/wikidata?${qs}`);
  if (!r.ok) return [];
  const data = await r.json();
  return data?.spots ?? [];
}

export default function Home() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);

  // add flow
  const [pendingProduction, setPendingProduction] = useState<TmdbSuggestion | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [pendingLocationName, setPendingLocationName] = useState("");

  // wikidata fetch state
  const [fetchingLocations, setFetchingLocations] = useState(false);
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);

  // load localStorage
  useEffect(() => {
    setPins(loadPins());
    setSavedIds(loadSavedIds());
  }, []);

  // persist
  useEffect(() => savePins(pins), [pins]);
  useEffect(() => saveSavedIds(savedIds), [savedIds]);

  const selectedPin = useMemo(
    () => pins.find((p) => p.id === selectedPinId) ?? null,
    [pins, selectedPinId]
  );

  function addSpotsAsPins(spots: WikiSpot[], production: TmdbSuggestion): Pin[] {
    const newPins: Pin[] = spots.map((spot) => ({
      id: makeId(),
      tmdbId: production.id,
      contentType: production.media_type,
      title: production.title,
      locationName: spot.locationName,
      lat: spot.lat,
      lng: spot.lng,
      createdAt: Date.now(),
    }));
    setPins((prev) => [...newPins, ...prev]);
    return newPins;
  }

  async function onPickProduction(s: TmdbSuggestion) {
    setPendingProduction(s);
    setPendingLocationName("");
    setLastFetchCount(null);
    setFetchingLocations(true);

    try {
      const spots = await fetchWikidataSpots("title", { q: s.title });

      if (spots.length > 0) {
        const newPins = addSpotsAsPins(spots, s);
        setLastFetchCount(newPins.length);
        setSelectedPinId(newPins[0].id);
        // Auto-placed — no need for manual pick mode
        setPickMode(false);
        setPendingProduction(null);
      } else {
        // No Wikidata results — fall back to manual map click
        setLastFetchCount(0);
        setPickMode(true);
      }
    } catch {
      setLastFetchCount(0);
      setPickMode(true);
    } finally {
      setFetchingLocations(false);
    }
  }

  function onPickLocationForNewPin(lat: number, lng: number) {
    if (!pendingProduction) return;

    const locationName = pendingLocationName.trim() || "Pinned location";

    const newPin: Pin = {
      id: makeId(),
      tmdbId: pendingProduction.id,
      contentType: pendingProduction.media_type,
      title: pendingProduction.title,
      locationName,
      lat,
      lng,
      createdAt: Date.now(),
    };

    setPins((prev) => [newPin, ...prev]);
    setSelectedPinId(newPin.id);

    setPickMode(false);
    setPendingProduction(null);
    setPendingLocationName("");
    setLastFetchCount(null);
  }

  function toggleSave(pinId: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(pinId) ? next.delete(pinId) : next.add(pinId);
      return next;
    });
  }

  async function onFilmedNearMe() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setFetchingLocations(true);
        setLastFetchCount(null);

        try {
          const spots = await fetchWikidataSpots("nearby", {
            lat: String(lat),
            lng: String(lng),
            km: "10",
          });

          if (spots.length === 0) {
            alert("No filming locations found near you (within 10 km).");
            return;
          }

          const newPins: Pin[] = spots.map((spot) => ({
            id: makeId(),
            tmdbId: 0,
            contentType: "movie" as const,
            title: spot.works || "Filmed here",
            locationName: spot.locationName,
            lat: spot.lat,
            lng: spot.lng,
            createdAt: Date.now(),
          }));

          setPins((prev) => [...newPins, ...prev]);
          setLastFetchCount(newPins.length);
          if (newPins.length > 0) setSelectedPinId(newPins[0].id);
        } finally {
          setFetchingLocations(false);
        }
      },
      () => {
        alert("Could not get your location. Please allow location access and try again.");
      }
    );
  }

  return (
    <div className="h-screen w-full bg-white">
      <div className="flex h-full w-full">
        {/* LEFT SIDEBAR */}
        <aside className="w-105 max-w-[92vw] border-r border-gray-200 bg-white">
          <div className="sticky top-0 z-10 bg-white px-4 pt-4 pb-3 border-b border-gray-200">
            <div className="flex items-center justify-between gap-2">
              <div className="text-lg font-semibold text-gray-900">Filmed Here 🎬</div>

              <button
                type="button"
                onClick={onFilmedNearMe}
                disabled={fetchingLocations}
                className="rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white hover:bg-black disabled:opacity-50"
              >
                Filmed near me
              </button>
            </div>

            <div className="mt-3">
              <SearchBox onPick={onPickProduction} disabled={fetchingLocations} />
            </div>

            {/* Status banner */}
            {fetchingLocations ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                <div className="text-sm text-gray-600">Fetching filming locations…</div>
              </div>
            ) : pickMode && pendingProduction ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-sm font-semibold text-gray-900">
                  Adding: {pendingProduction.title}
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {lastFetchCount === 0
                    ? "No Wikidata locations found — click the map to pin manually."
                    : "Click on the map to drop a pin."}
                </div>

                <input
                  value={pendingLocationName}
                  onChange={(e) => setPendingLocationName(e.target.value)}
                  placeholder="Location label (e.g., Alamo Square Painted Ladies)"
                  className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-200"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPickMode(false);
                      setPendingProduction(null);
                      setPendingLocationName("");
                      setLastFetchCount(null);
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : lastFetchCount != null && lastFetchCount > 0 ? (
              <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="text-xs text-gray-600">
                  ✓ Added {lastFetchCount} filming location{lastFetchCount !== 1 ? "s" : ""} from Wikidata.
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-gray-500">
                Search a title to auto-load its filming locations, or click a pin to see details.
              </div>
            )}
          </div>

          {/* Pins list */}
          <div className="h-[calc(100%-170px)] overflow-y-auto px-2 py-2">
            {pins.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-600">
                No pins yet. Search a movie or show to load its filming spots ✨
              </div>
            ) : (
              pins.map((p) => {
                const isSaved = savedIds.has(p.id);
                const isSelected = selectedPinId === p.id;

                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPinId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedPinId(p.id);
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left mb-2 shadow-sm transition cursor-pointer ${
                      isSelected ? "border-gray-900 bg-white" : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 truncate">{p.title}</div>
                          <div className="text-xs text-gray-500">{p.contentType.toUpperCase()}</div>
                          {isSaved ? <div className="text-xs">⭐</div> : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-600 truncate">{p.locationName}</div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(p.id);
                        }}
                        className="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs text-gray-900 hover:bg-gray-50"
                      >
                        {isSaved ? "Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-200 p-4 text-sm text-gray-600">
            Click a pin to open details.
          </div>
        </aside>

        {/* MAP */}
        <main className="relative flex-1">
          <MapView
            pins={pins}
            selectedId={selectedPinId}
            onSelectPin={(id) => setSelectedPinId(id)}
            pickMode={pickMode}
            onPickLocationForNewPin={onPickLocationForNewPin}
          />

          {/* RIGHT DETAILS PANEL */}
          {selectedPin ? (
            <div className="absolute top-0 right-0 h-full w-95 max-w-[92vw]">
              <SidePanel
                pin={selectedPin}
                saved={savedIds.has(selectedPin.id)}
                onClose={() => setSelectedPinId(null)}
                onToggleSave={() => toggleSave(selectedPin.id)}
              />
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
