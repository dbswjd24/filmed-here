import { Pin } from "./types";

const PINS_KEY = "filmed_here_pins_v1";
const SAVED_KEY = "filmed_here_saved_pin_ids_v1";

export function loadPins(): Pin[] {
  try {
    const raw = localStorage.getItem(PINS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function savePins(pins: Pin[]) {
  localStorage.setItem(PINS_KEY, JSON.stringify(pins));
}

export function loadSavedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSavedIds(ids: Set<string>) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(ids)));
}
