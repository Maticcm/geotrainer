import { FEATURE_BY_ID, SYLLABUS_FEATURES } from "@/data/features";
import { CATEGORIES, type Difficulty, type GeographyCategory, type Lang } from "./types";
import { type FeatureProgress, masteryLevel, newFeatureProgress, qualityOf, reviewFeature } from "./srs";

export const STORAGE_KEY = "geotrainer:progress";
export const SCHEMA_VERSION = 1;

export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  lang: Lang;
  theme: ThemePref;
  sound: boolean;
  difficulty: Difficulty;
  questionCount: number;
  speedrunDuration: number;
  speedrunMultiplier: boolean;
}

export type GameMode = "locate" | "speedrun" | "weak" | "exam";
export const GAME_MODES: GameMode[] = ["locate", "speedrun", "weak", "exam"];

export interface SessionRecord {
  id: string;
  mode: GameMode;
  categories: GeographyCategory[];
  finishedAt: number;
  score: number;
  correct: number;
  total: number;
  avgTimeMs: number;
}

export interface Stats {
  sessions: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticed: number;
  /** Local dates (YYYY-MM-DD) with at least one answer; capped to 400 entries. */
  studyDays: string[];
}

export interface ProgressData {
  version: number;
  features: Record<string, FeatureProgress>;
  stats: Stats;
  history: SessionRecord[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: "sl",
  theme: "system",
  sound: true,
  difficulty: "normal",
  questionCount: 10,
  speedrunDuration: 60,
  speedrunMultiplier: true,
};

export function defaultProgress(): ProgressData {
  return {
    version: SCHEMA_VERSION,
    features: {},
    stats: { sessions: 0, bestScore: 0, currentStreak: 0, longestStreak: 0, lastPracticed: 0, studyDays: [] },
    history: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ---------- sanitising (missing / malformed / outdated data) ----------
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (typeof v === "string" && (opts as readonly string[]).includes(v) ? (v as T) : d);

function sanitizeFeature(v: unknown): FeatureProgress | null {
  if (!isObj(v)) return null;
  const d = newFeatureProgress();
  const attempts = Math.floor(num(v.attempts, 0, 0));
  const correct = Math.min(attempts, Math.floor(num(v.correct, 0, 0)));
  return {
    attempts,
    correct,
    incorrect: Math.min(attempts - correct, Math.floor(num(v.incorrect, attempts - correct, 0))),
    totalTimeMs: num(v.totalTimeMs, 0, 0),
    ease: num(v.ease, d.ease, 1.3, 4),
    interval: num(v.interval, 0, 0, 3650),
    repetitions: Math.floor(num(v.repetitions, 0, 0)),
    lapses: Math.floor(num(v.lapses, 0, 0)),
    due: num(v.due, 0, 0),
    lastSeen: num(v.lastSeen, 0, 0),
    lastResult: typeof v.lastResult === "boolean" ? v.lastResult : null,
  };
}

/** Turn arbitrary parsed JSON into a valid ProgressData. Never throws. */
export function sanitizeProgress(raw: unknown): ProgressData {
  const out = defaultProgress();
  if (!isObj(raw)) return out;
  // version 0/absent: legacy shape is identical for now; future versions migrate here.
  if (isObj(raw.features)) {
    for (const [id, v] of Object.entries(raw.features)) {
      const f = sanitizeFeature(v);
      if (f) out.features[id] = f;
    }
  }
  if (isObj(raw.stats)) {
    const s = raw.stats;
    out.stats = {
      sessions: Math.floor(num(s.sessions, 0, 0)),
      bestScore: num(s.bestScore, 0, 0),
      currentStreak: Math.floor(num(s.currentStreak, 0, 0)),
      longestStreak: Math.floor(num(s.longestStreak, 0, 0)),
      lastPracticed: num(s.lastPracticed, 0, 0),
      studyDays: Array.isArray(s.studyDays) ? s.studyDays.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-400) : [],
    };
  }
  if (Array.isArray(raw.history)) {
    out.history = raw.history
      .filter(isObj)
      .map((h): SessionRecord => ({
        id: typeof h.id === "string" ? h.id : String(h.finishedAt ?? Math.random()),
        mode: oneOf(h.mode, GAME_MODES, "locate"),
        categories: Array.isArray(h.categories) ? h.categories.filter((c): c is GeographyCategory => CATEGORIES.includes(c as GeographyCategory)) : [],
        finishedAt: num(h.finishedAt, 0, 0),
        score: num(h.score, 0, 0),
        correct: Math.floor(num(h.correct, 0, 0)),
        total: Math.floor(num(h.total, 0, 0)),
        avgTimeMs: num(h.avgTimeMs, 0, 0),
      }))
      .slice(-30);
  }
  if (isObj(raw.settings)) {
    const s = raw.settings;
    out.settings = {
      lang: oneOf(s.lang, ["sl", "en"] as const, "sl"),
      theme: oneOf(s.theme, ["system", "light", "dark"] as const, "system"),
      sound: typeof s.sound === "boolean" ? s.sound : true,
      difficulty: oneOf(s.difficulty, ["easy", "normal", "hard"] as const, "normal"),
      questionCount: Math.floor(num(s.questionCount, 10, 1, 200)),
      speedrunDuration: Math.floor(num(s.speedrunDuration, 60, 10, 600)),
      speedrunMultiplier: typeof s.speedrunMultiplier === "boolean" ? s.speedrunMultiplier : true,
    };
  }
  return out;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadProgress(storage: StorageLike | null): ProgressData {
  if (!storage) return defaultProgress();
  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return defaultProgress();
  }
  if (!text) return defaultProgress();
  try {
    return sanitizeProgress(JSON.parse(text));
  } catch {
    // keep the unreadable payload so nothing is silently destroyed
    try {
      storage.setItem(STORAGE_KEY + ":corrupt", text);
    } catch {
      /* ignore */
    }
    return defaultProgress();
  }
}

export function saveProgress(storage: StorageLike | null, data: ProgressData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---------- pure updates ----------
export function localDay(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface AnswerRecord {
  featureId: string;
  correct: boolean;
  accuracy: number;
  timeMs: number;
  now: number;
}

export function recordAnswer(data: ProgressData, a: AnswerRecord): ProgressData {
  const prev = data.features[a.featureId] ?? newFeatureProgress();
  const next = reviewFeature(prev, qualityOf(a.correct, a.accuracy, a.timeMs), a.timeMs, a.now);
  const streak = a.correct ? data.stats.currentStreak + 1 : 0;
  const day = localDay(a.now);
  const days = data.stats.studyDays.includes(day) ? data.stats.studyDays : [...data.stats.studyDays, day].slice(-400);
  return {
    ...data,
    features: { ...data.features, [a.featureId]: next },
    stats: {
      ...data.stats,
      currentStreak: streak,
      longestStreak: Math.max(data.stats.longestStreak, streak),
      lastPracticed: a.now,
      studyDays: days,
    },
  };
}

export function recordSession(data: ProgressData, s: SessionRecord): ProgressData {
  return {
    ...data,
    stats: { ...data.stats, sessions: data.stats.sessions + 1, bestScore: Math.max(data.stats.bestScore, s.score) },
    history: [...data.history, s].slice(-30),
  };
}

// ---------- derived statistics ----------
export function studyStreakDays(days: string[], now: number): number {
  const set = new Set(days);
  let count = 0;
  const d = new Date(now);
  if (!set.has(localDay(d.getTime()))) d.setDate(d.getDate() - 1); // today not yet studied: streak still alive until midnight
  while (set.has(localDay(d.getTime()))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export interface CategoryStat {
  category: GeographyCategory;
  total: number;
  learned: number;
  attempts: number;
  correct: number;
  accuracy: number | null;
  mastery: number;
}

export function categoryStats(data: ProgressData): CategoryStat[] {
  return CATEGORIES.map((category) => {
    const feats = SYLLABUS_FEATURES.filter((f) => f.category === category);
    let attempts = 0, correct = 0, learned = 0, levelSum = 0;
    for (const f of feats) {
      const p = data.features[f.id];
      if (p) {
        attempts += p.attempts;
        correct += p.correct;
      }
      const lvl = masteryLevel(p);
      levelSum += lvl;
      if (lvl >= 3) learned++;
    }
    return {
      category,
      total: feats.length,
      learned,
      attempts,
      correct,
      accuracy: attempts ? correct / attempts : null,
      mastery: feats.length ? levelSum / (feats.length * 4) : 0,
    };
  });
}

export function overallStats(data: ProgressData) {
  const cats = categoryStats(data);
  const total = SYLLABUS_FEATURES.length;
  const levelSum = SYLLABUS_FEATURES.reduce((s, f) => s + masteryLevel(data.features[f.id]), 0);
  let attempts = 0, correct = 0, learned = 0, totalTime = 0;
  for (const f of SYLLABUS_FEATURES) {
    const p = data.features[f.id];
    if (!p) continue;
    attempts += p.attempts;
    correct += p.correct;
    totalTime += p.totalTimeMs;
    if (masteryLevel(p) >= 3) learned++;
  }
  return {
    total,
    mastery: total ? levelSum / (total * 4) : 0,
    accuracy: attempts ? correct / attempts : null,
    attempts,
    learned,
    avgTimeMs: attempts ? totalTime / attempts : 0,
    cats,
  };
}

/** Features with some history, worst first. */
export function weakFeatureIds(data: ProgressData): string[] {
  return Object.keys(data.features)
    .filter((id) => FEATURE_BY_ID.get(id)?.syllabus && data.features[id].attempts > 0 && masteryLevel(data.features[id]) < 4)
    .sort((a, b) => weakness(data, b) - weakness(data, a));
}

function weakness(data: ProgressData, id: string) {
  const p = data.features[id];
  return (p.incorrect / Math.max(1, p.attempts)) * 3 + p.lapses * 0.5 + (p.lastResult === false ? 1 : 0) + (2.5 - p.ease) * 0.5;
}
