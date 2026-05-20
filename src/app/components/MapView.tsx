"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Pin } from "./types";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapView({
  pins,
  selectedId,
  onSelectPin,
  onPickLocationForNewPin,
  pickMode,
}: {
  pins: Pin[];
  selectedId: string | null;
  onSelectPin: (id: string) => void;
  pickMode: boolean;
  onPickLocationForNewPin: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-122.431, 37.78],
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("click", (e) => {
      if (!pickMode) return;
      onPickLocationForNewPin(e.lngLat.lat, e.lngLat.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [pickMode, onPickLocationForNewPin]);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    for (const p of pins) {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "999px";
      el.style.border = "2px solid white";
      el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
      el.style.background = p.id === selectedId ? "#f59e0b" : "#111827";
      el.style.cursor = "pointer";

      el.addEventListener("click", () => onSelectPin(p.id));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);

      markersRef.current.set(p.id, marker);
    }
  }, [pins, selectedId, onSelectPin]);

  // fly to selected
  useEffect(() => {
    if (!selectedId) return;
    const map = mapRef.current;
    const pin = pins.find((p) => p.id === selectedId);
    if (!map || !pin) return;
    map.flyTo({ center: [pin.lng, pin.lat], zoom: 14 });
  }, [selectedId, pins]);

  return <div ref={containerRef} className="h-full w-full" />;
}
