"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { translate, type MessageKey, type Params } from "./i18n";
import { studyStreakDays, type ProgressData, type Settings } from "./progress";
import { getProgress, getServerProgress, subscribe, updateProgress } from "./store";

export function useProgress(): ProgressData {
  return useSyncExternalStore(subscribe, getProgress, getServerProgress);
}

/** False during SSR/hydration, true once localStorage has been read. */
export function useReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function useSettings() {
  const { settings } = useProgress();
  const setSettings = useCallback((patch: Partial<Settings>) => {
    updateProgress((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);
  return [settings, setSettings] as const;
}

export function useT() {
  const { settings } = useProgress();
  const lang = settings.lang;
  const t = useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);
  return { t, lang };
}

/** Keeps <html> class/lang in sync with settings. */
export function useApplyTheme() {
  const { settings } = useProgress();
  useEffect(() => {
    document.documentElement.lang = settings.lang;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.lang, settings.theme]);
}

export function useIsDark(): boolean {
  const { settings } = useProgress();
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => settings.theme === "dark" || (settings.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches),
    () => false,
  );
}

export function useStudyStreak(studyDays: string[]): number {
  return useSyncExternalStore(
    subscribe,
    () => studyStreakDays(studyDays, Date.now()),
    () => 0,
  );
}
