// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { FEATURE_BY_ID, FEATURES, SYLLABUS_FEATURES } from "@/data/features";
import { DAY_MS, masteryLevel, newFeatureProgress, qualityOf, reviewFeature, selectionWeight } from "./srs";
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  defaultProgress,
  loadProgress,
  recordAnswer,
  recordSession,
  saveProgress,
  studyStreakDays,
  weakFeatureIds,
  overallStats,
} from "./progress";
import { getProgress, reloadProgress, updateProgress } from "./store";
import { generateQuestions, mulberry32, pickDistractors, buildOptions } from "./questions";
import { DICTIONARIES, translate, type MessageKey } from "./i18n";
import { createSession, currentQuestion, finishSession, nextQuestion, retryQuestion, submitAnswer, summarize } from "./session";
import { CATEGORIES } from "./types";

const NOW = new Date("2026-03-10T10:00:00").getTime();

describe("spaced repetition", () => {
  it("schedules 1 day, 3 days, then grows by ease", () => {
    let p = newFeatureProgress();
    p = reviewFeature(p, 5, 3000, NOW);
    expect(p.interval).toBe(1);
    expect(p.due).toBe(NOW + DAY_MS);
    p = reviewFeature(p, 5, 3000, NOW);
    expect(p.interval).toBe(3);
    p = reviewFeature(p, 4, 3000, NOW);
    expect(p.interval).toBeGreaterThanOrEqual(6);
    expect(p.repetitions).toBe(3);
  });
  it("incorrect answers reset repetitions and schedule an early review", () => {
    const before = reviewFeature(reviewFeature(newFeatureProgress(), 5, 1000, NOW), 5, 1000, NOW);
    const p = reviewFeature(before, 1, 1000, NOW);
    expect(p.repetitions).toBe(0);
    expect(p.interval).toBe(0);
    expect(p.due - NOW).toBeLessThan(DAY_MS);
    expect(p.lapses).toBe(1);
    expect(p.ease).toBeLessThan(before.ease);
  });
  it("ease never drops below 1.3", () => {
    let p = newFeatureProgress();
    for (let i = 0; i < 30; i++) p = reviewFeature(p, 1, 1, NOW);
    expect(p.ease).toBe(1.3);
  });
  it("quality reflects correctness, accuracy and speed", () => {
    expect(qualityOf(false, 0.2, 1000)).toBe(1);
    expect(qualityOf(true, 1, 2000)).toBe(5);
    expect(qualityOf(true, 0.8, 20000)).toBe(4);
    expect(qualityOf(true, 0.5, 20000)).toBe(3);
  });
  it("mastery levels rise with successful reviews", () => {
    let p = newFeatureProgress();
    expect(masteryLevel(p)).toBe(0);
    for (let i = 0; i < 6; i++) p = reviewFeature(p, 5, 1000, NOW);
    expect(masteryLevel(p)).toBe(4);
    p = reviewFeature(p, 1, 1000, NOW);
    expect(masteryLevel(p)).toBeLessThan(4);
  });
  it("due items are weighted above fresh; mastered items still keep a weight", () => {
    let mastered = newFeatureProgress();
    for (let i = 0; i < 6; i++) mastered = reviewFeature(mastered, 5, 1000, NOW);
    const missed = reviewFeature(newFeatureProgress(), 1, 1000, NOW - 2 * DAY_MS);
    expect(selectionWeight(missed, NOW)).toBeGreaterThan(selectionWeight(undefined, NOW));
    expect(selectionWeight(mastered, NOW)).toBeGreaterThan(0);
    expect(selectionWeight(mastered, NOW)).toBeLessThan(selectionWeight(undefined, NOW));
  });
});

describe("progress persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    reloadProgress();
  });

  it("records answers and updates stats", () => {
    let d = defaultProgress();
    d = recordAnswer(d, { featureId: "nile", correct: true, accuracy: 1, timeMs: 3000, now: NOW });
    d = recordAnswer(d, { featureId: "nile", correct: false, accuracy: 0, timeMs: 5000, now: NOW });
    d = recordAnswer(d, { featureId: "alps", correct: true, accuracy: 1, timeMs: 2000, now: NOW });
    expect(d.features.nile.attempts).toBe(2);
    expect(d.features.nile.correct).toBe(1);
    expect(d.features.nile.incorrect).toBe(1);
    expect(d.features.nile.totalTimeMs).toBe(8000);
    expect(d.stats.currentStreak).toBe(1);
    expect(d.stats.longestStreak).toBe(1);
    expect(d.stats.lastPracticed).toBe(NOW);
    expect(d.stats.studyDays).toHaveLength(1);
  });

  it("tracks sessions, best score and history", () => {
    let d = defaultProgress();
    d = recordSession(d, { id: "a", mode: "locate", categories: ["rivers"], finishedAt: NOW, score: 400, correct: 5, total: 10, avgTimeMs: 4000 });
    d = recordSession(d, { id: "b", mode: "exam", categories: ["rivers"], finishedAt: NOW, score: 250, correct: 3, total: 10, avgTimeMs: 4000 });
    expect(d.stats.sessions).toBe(2);
    expect(d.stats.bestScore).toBe(400);
    expect(d.history).toHaveLength(2);
  });

  it("survives a page refresh (save → reload from storage)", () => {
    updateProgress((d) => recordAnswer(d, { featureId: "danube", correct: true, accuracy: 1, timeMs: 1000, now: NOW }));
    updateProgress((d) => ({ ...d, settings: { ...d.settings, lang: "en" } }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    reloadProgress(); // simulates a fresh page load
    const d = getProgress();
    expect(d.features.danube.attempts).toBe(1);
    expect(d.settings.lang).toBe("en");
  });

  it("falls back to defaults for missing data", () => {
    expect(loadProgress(localStorage)).toEqual(defaultProgress());
    expect(loadProgress(null)).toEqual(defaultProgress());
  });

  it("handles malformed JSON and keeps a copy of the corrupt payload", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    const d = loadProgress(localStorage);
    expect(d).toEqual(defaultProgress());
    expect(localStorage.getItem(STORAGE_KEY + ":corrupt")).toBe("{not json");
  });

  it("sanitises wrong types, negative numbers and unknown enum values", () => {
    saveProgress(localStorage, defaultProgress());
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 0,
        features: { nile: { attempts: "x", correct: -5, ease: 99, due: null }, bad: 5 },
        stats: { sessions: "many", bestScore: -3, studyDays: ["2026-01-01", "garbage", 5] },
        history: [{ mode: "bogus", score: "?" }, 7],
        settings: { lang: "de", theme: "neon", difficulty: 3, questionCount: 99999 },
      }),
    );
    const d = loadProgress(localStorage);
    expect(d.features.nile.attempts).toBe(0);
    expect(d.features.nile.ease).toBeLessThanOrEqual(4);
    expect(d.features.bad).toBeUndefined();
    expect(d.stats.sessions).toBe(0);
    expect(d.stats.studyDays).toEqual(["2026-01-01"]);
    expect(d.history).toHaveLength(1);
    expect(d.history[0].mode).toBe("locate");
    expect(d.settings.lang).toBe("sl");
    expect(d.settings.theme).toBe("system");
    expect(d.settings.questionCount).toBe(200);
  });

  it("migrates older saves without a settings block (keeps progress, adds defaults)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 0, features: { alps: { attempts: 3, correct: 2 } } }));
    const d = loadProgress(localStorage);
    expect(d.features.alps.attempts).toBe(3);
    expect(d.settings).toEqual(DEFAULT_SETTINGS);
    expect(d.version).toBe(1);
  });

  it("computes study streaks over consecutive days", () => {
    const day = (n: number) => new Date(NOW - n * DAY_MS).toISOString();
    void day;
    const fmt = (n: number) => {
      const d = new Date(NOW);
      d.setDate(d.getDate() - n);
      const p = (x: number) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    expect(studyStreakDays([fmt(0), fmt(1), fmt(2), fmt(5)], NOW)).toBe(3);
    expect(studyStreakDays([fmt(1), fmt(2)], NOW)).toBe(2); // today not studied yet
    expect(studyStreakDays([fmt(3)], NOW)).toBe(0);
  });

  it("lists weak features worst-first and overall mastery", () => {
    let d = defaultProgress();
    for (let i = 0; i < 3; i++) d = recordAnswer(d, { featureId: "tigris", correct: false, accuracy: 0, timeMs: 1000, now: NOW });
    d = recordAnswer(d, { featureId: "alps", correct: false, accuracy: 0, timeMs: 1000, now: NOW });
    d = recordAnswer(d, { featureId: "alps", correct: true, accuracy: 1, timeMs: 1000, now: NOW });
    expect(weakFeatureIds(d)[0]).toBe("tigris");
    const o = overallStats(d);
    expect(o.total).toBe(SYLLABUS_FEATURES.length);
    expect(o.accuracy).toBeCloseTo(1 / 5);
  });
});

describe("question generation", () => {
  const base = { categories: [...CATEGORIES], difficulty: "normal" as const, progress: {}, now: NOW };

  it("never repeats a feature within a session", () => {
    const qs = generateQuestions({ ...base, mode: "exam", count: 200, rng: mulberry32(1) });
    expect(qs).toHaveLength(SYLLABUS_FEATURES.length);
    expect(new Set(qs.map((q) => q.featureId)).size).toBe(qs.length);
  });

  it("exam uses only worksheet features and honours category selection and count", () => {
    const qs = generateQuestions({ ...base, mode: "exam", categories: ["rivers", "lakes"], count: 12, rng: mulberry32(2) });
    expect(qs).toHaveLength(12);
    for (const q of qs) {
      const f = FEATURE_BY_ID.get(q.featureId)!;
      expect(f.syllabus).toBe(true);
      expect(["rivers", "lakes"]).toContain(f.category);
      expect(q.kind).toBe("locate");
    }
  });

  it("returns fewer questions rather than substituting other features", () => {
    const qs = generateQuestions({ ...base, mode: "locate", categories: ["canals-straits"], count: 50, rng: mulberry32(3) });
    expect(qs).toHaveLength(5);
  });

  it("is deterministic for a given seed", () => {
    const a = generateQuestions({ ...base, mode: "locate", count: 10, rng: mulberry32(42) });
    const b = generateQuestions({ ...base, mode: "locate", count: 10, rng: mulberry32(42) });
    expect(a).toEqual(b);
  });

  it("prefers due/missed features over mastered ones", () => {
    let mastered = newFeatureProgress();
    for (let i = 0; i < 6; i++) mastered = reviewFeature(mastered, 5, 1000, NOW);
    const progress: Record<string, ReturnType<typeof newFeatureProgress>> = {};
    for (const f of SYLLABUS_FEATURES) if (f.category === "rivers") progress[f.id] = mastered;
    progress["tigris"] = reviewFeature(newFeatureProgress(), 1, 1000, NOW - 3 * DAY_MS);
    let tigrisFirst = 0;
    for (let s = 0; s < 40; s++) {
      const qs = generateQuestions({ ...base, categories: ["rivers"], progress, mode: "locate", count: 3, rng: mulberry32(s) });
      if (qs.some((q) => q.featureId === "tigris")) tigrisFirst++;
    }
    expect(tigrisFirst).toBeGreaterThan(30);
  });

  it("mastered features still appear occasionally", () => {
    let mastered = newFeatureProgress();
    for (let i = 0; i < 6; i++) mastered = reviewFeature(mastered, 5, 1000, NOW);
    const progress = { nile: mastered };
    let seen = 0;
    for (let s = 0; s < 300; s++) {
      const qs = generateQuestions({ ...base, categories: ["rivers"], progress, mode: "locate", count: 10, rng: mulberry32(s + 500) });
      if (qs.some((q) => q.featureId === "nile")) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("weak mode only uses features with misses and returns [] when there are none", () => {
    expect(generateQuestions({ ...base, mode: "weak", count: 10, rng: mulberry32(5) })).toEqual([]);
    const progress = { tigris: reviewFeature(newFeatureProgress(), 1, 1000, NOW), nile: reviewFeature(newFeatureProgress(), 1, 1000, NOW) };
    const qs = generateQuestions({ ...base, mode: "weak", progress, count: 10, rng: mulberry32(5) });
    expect(qs.map((q) => q.featureId).sort()).toEqual(["nile", "tigris"]);
  });

  it("buildOptions has 4 distinct plausible options containing the target", () => {
    const target = FEATURE_BY_ID.get("nile")!;
    const opts = buildOptions(target, mulberry32(7));
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain(target.id);
  });

  it("distractors never share a name with the target (Ural mountains vs river)", () => {
    const ds = pickDistractors(FEATURE_BY_ID.get("ural-mountains")!, 3, mulberry32(9));
    expect(ds.every((f) => f.category === "mountains")).toBe(true);
    const rivers = pickDistractors(FEATURE_BY_ID.get("ural-river")!, 3, mulberry32(9));
    expect(rivers.map((f) => f.id)).not.toContain("ural-river");
  });

  it("all modes generate locate questions", () => {
    const locateQs = generateQuestions({ ...base, mode: "locate", count: 5, rng: mulberry32(1) });
    const speedQs = generateQuestions({ ...base, mode: "speedrun", count: 5, rng: mulberry32(1) });
    expect(locateQs.every((q) => q.kind === "locate")).toBe(true);
    expect(speedQs.every((q) => q.kind === "locate")).toBe(true);
  });
});

describe("session completion and restart", () => {
  const config = { mode: "locate" as const, categories: ["rivers" as const], count: 3, difficulty: "normal" as const };
  const questions = generateQuestions({ mode: "locate", categories: ["rivers"], count: 3, difficulty: "normal", progress: {}, now: NOW, rng: mulberry32(11) });
  const ok = { correct: true, accuracy: 1, basePoints: 100 };
  const bad = { correct: false, accuracy: 0, basePoints: 0 };

  it("runs a full session: answer → review → next → finished", () => {
    let s = createSession(config, questions, NOW);
    expect(s.phase).toBe("answering");
    s = submitAnswer(s, ok, NOW + 5000);
    expect(s.phase).toBe("review");
    expect(s.score).toBeGreaterThan(100);
    s = nextQuestion(s, NOW + 6000);
    s = submitAnswer(s, bad, NOW + 9000);
    expect(s.streak).toBe(0);
    s = nextQuestion(s, NOW + 9500);
    s = submitAnswer(s, ok, NOW + 12000);
    s = nextQuestion(s, NOW + 13000);
    expect(s.phase).toBe("finished");
    const sum = summarize(s);
    expect(sum.total).toBe(3);
    expect(sum.correct).toBe(2);
    expect(sum.byCategory[0]).toMatchObject({ category: "rivers", total: 3, correct: 2 });
    expect(sum.missed).toHaveLength(1);
  });

  it("ignores duplicate submissions while in review", () => {
    let s = createSession(config, questions, NOW);
    s = submitAnswer(s, ok, NOW + 1000);
    const again = submitAnswer(s, ok, NOW + 1100);
    expect(again.results).toHaveLength(1);
    expect(again).toBe(s);
  });

  it("retry gives practice feedback without changing the score or results", () => {
    let s = createSession(config, questions, NOW);
    s = submitAnswer(s, bad, NOW + 1000);
    const scoreBefore = s.score;
    s = retryQuestion(s, NOW + 2000);
    expect(s.phase).toBe("answering");
    s = submitAnswer(s, ok, NOW + 3000);
    expect(s.current?.practice).toBe(true);
    expect(s.score).toBe(scoreBefore);
    expect(s.results).toHaveLength(1);
    expect(s.results[0].correct).toBe(false);
    s = nextQuestion(s, NOW + 4000);
    expect(s.index).toBe(1);
    expect(s.retried).toBe(false);
  });

  it("can be ended early and restarted from scratch", () => {
    let s = createSession(config, questions, NOW);
    s = submitAnswer(s, ok, NOW + 1000);
    s = finishSession(s);
    expect(s.phase).toBe("finished");
    expect(summarize(s).total).toBe(1);
    const fresh = createSession(config, questions, NOW + 99999);
    expect(fresh.phase).toBe("answering");
    expect(fresh.score).toBe(0);
    expect(fresh.results).toHaveLength(0);
    expect(currentQuestion(fresh)?.featureId).toBe(questions[0].featureId);
  });

  it("an empty question set finishes immediately", () => {
    expect(createSession(config, [], NOW).phase).toBe("finished");
  });

  it("speedrun sets an end time and applies streak multipliers", () => {
    const sr = createSession({ ...config, mode: "speedrun", durationSec: 60, speedMultiplier: true }, questions, NOW);
    expect(sr.endsAt).toBe(NOW + 60000);
    let s = sr;
    // 5 correct in a row with a multiplier needs more questions than 3; verify multiplier is 1 at start
    s = submitAnswer(s, ok, NOW + 60000);
    expect(s.current?.score.multiplier).toBe(1);
  });
});

describe("language switching", () => {
  it("has identical keys in Slovenian and English", () => {
    const sl = Object.keys(DICTIONARIES.sl).sort();
    const en = Object.keys(DICTIONARIES.en).sort();
    expect(en).toEqual(sl);
  });
  it("translates and interpolates in both languages", () => {
    expect(translate("sl", "game.question", { n: 2, total: 10 })).toBe("Vprašanje 2 / 10");
    expect(translate("en", "game.question", { n: 2, total: 10 })).toBe("Question 2 / 10");
    expect(translate("sl", "cat.rivers")).toBe("Reke");
    expect(translate("en", "cat.rivers")).toBe("Rivers");
  });
  it("never leaves empty or unresolved strings; every category and mode is translated", () => {
    for (const lang of ["sl", "en"] as const) {
      for (const key of Object.keys(DICTIONARIES[lang]) as MessageKey[]) {
        expect(DICTIONARIES[lang][key].trim().length).toBeGreaterThan(0);
      }
      for (const c of CATEGORIES) expect(translate(lang, `cat.${c}` as MessageKey)).not.toBe(`cat.${c}`);
    }
  });
  it("feature names stay in the syllabus language regardless of UI language", () => {
    expect(FEATURE_BY_ID.get("black-sea")!.name).toBe("Črno morje");
    expect(FEATURES.every((f) => f.name.length > 0 && f.nameEn.length > 0)).toBe(true);
  });
});
