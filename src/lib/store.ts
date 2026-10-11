import { defaultProgress, loadProgress, saveProgress, type ProgressData, STORAGE_KEY } from "./progress";

let state: ProgressData = defaultProgress();
let loaded = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = loadProgress(storage());
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      state = loadProgress(storage());
      emit();
    }
  });
}

function emit() {
  listeners.forEach((l) => l());
}

export function getProgress(): ProgressData {
  ensureLoaded();
  return state;
}

export const getServerProgress = (): ProgressData => state;

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Apply a pure update and persist it immediately. */
export function updateProgress(fn: (d: ProgressData) => ProgressData): void {
  ensureLoaded();
  state = fn(state);
  saveProgress(storage(), state);
  emit();
}

/** Test helper: drop in-memory state and reload from storage. */
export function reloadProgress(): void {
  loaded = false;
  state = defaultProgress();
  ensureLoaded();
  emit();
}
