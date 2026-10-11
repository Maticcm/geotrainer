import { FEATURE_BY_ID } from "@/data/features";
import type { LocateEvaluation } from "./evaluation";
import type { GameMode } from "./progress";
import type { Question } from "./questions";
import { computeScore, speedrunMultiplier, type ScoreResult } from "./scoring";
import { CATEGORIES, type Difficulty, type GeographyCategory, type LatLng } from "./types";

export interface SessionConfig {
  mode: GameMode;
  categories: GeographyCategory[];
  count: number;
  difficulty: Difficulty;
  /** Speedrun only. */
  durationSec?: number;
  speedMultiplier?: boolean;
}

export interface AnswerInput {
  correct: boolean;
  accuracy: number;
  basePoints: number;
  guess?: LatLng;
  evaluation?: LocateEvaluation;
  typed?: string;
  choiceId?: string;
  hintUsed?: boolean;
}

export interface AnswerResult extends AnswerInput {
  questionId: string;
  featureId: string;
  timeMs: number;
  score: ScoreResult;
  /** A retry after a first attempt: shown for practice, never scored or recorded. */
  practice: boolean;
}

export type Phase = "answering" | "review" | "finished";

export interface SessionState {
  config: SessionConfig;
  questions: Question[];
  index: number;
  phase: Phase;
  /** Scored results (one per question). */
  results: AnswerResult[];
  /** Result currently under review (may be a practice retry). */
  current: AnswerResult | null;
  retried: boolean;
  score: number;
  streak: number;
  bestStreak: number;
  startedAt: number;
  questionStartedAt: number;
  endsAt: number | null;
}

export function createSession(config: SessionConfig, questions: Question[], now: number): SessionState {
  return {
    config,
    questions,
    index: 0,
    phase: questions.length ? "answering" : "finished",
    results: [],
    current: null,
    retried: false,
    score: 0,
    streak: 0,
    bestStreak: 0,
    startedAt: now,
    questionStartedAt: now,
    endsAt: config.mode === "speedrun" && config.durationSec ? now + config.durationSec * 1000 : null,
  };
}

export const currentQuestion = (s: SessionState): Question | undefined => s.questions[s.index];

export function submitAnswer(s: SessionState, input: AnswerInput, now: number): SessionState {
  const q = currentQuestion(s);
  if (!q || s.phase !== "answering") return s;
  const timeMs = Math.max(0, now - s.questionStartedAt);
  if (s.retried) {
    // practice retry: feedback only
    const practice: AnswerResult = {
      ...input,
      questionId: q.id,
      featureId: q.featureId,
      timeMs,
      practice: true,
      score: { base: 0, speed: 0, streak: 0, multiplier: 1, total: 0, streakAfter: s.streak },
    };
    return { ...s, phase: "review", current: practice };
  }
  const mult = s.config.mode === "speedrun" ? speedrunMultiplier(s.streak, !!s.config.speedMultiplier) : 1;
  const score = computeScore({
    correct: input.correct,
    basePoints: input.hintUsed ? input.basePoints * 0.7 : input.basePoints,
    timeMs,
    streakBefore: s.streak,
    difficulty: s.config.difficulty,
    speedBonus: s.config.mode !== "exam",
    multiplier: mult,
  });
  const result: AnswerResult = { ...input, questionId: q.id, featureId: q.featureId, timeMs, score, practice: false };
  return {
    ...s,
    phase: "review",
    current: result,
    results: [...s.results, result],
    score: s.score + score.total,
    streak: score.streakAfter,
    bestStreak: Math.max(s.bestStreak, score.streakAfter),
  };
}

export function retryQuestion(s: SessionState, now: number): SessionState {
  if (s.phase !== "review") return s;
  return { ...s, phase: "answering", current: null, retried: true, questionStartedAt: now };
}

export function nextQuestion(s: SessionState, now: number): SessionState {
  if (s.phase !== "review") return s;
  if (s.index + 1 >= s.questions.length) return { ...s, phase: "finished", current: null };
  return { ...s, index: s.index + 1, phase: "answering", current: null, retried: false, questionStartedAt: now };
}

/** Timer expiry (speedrun) or quitting early. An unanswered question is not counted. */
export function finishSession(s: SessionState): SessionState {
  return s.phase === "finished" ? s : { ...s, phase: "finished", current: null };
}

export interface CategoryBreakdown {
  category: GeographyCategory;
  correct: number;
  total: number;
}

export interface Summary {
  total: number;
  correct: number;
  accuracy: number;
  score: number;
  avgTimeMs: number;
  bestStreak: number;
  byCategory: CategoryBreakdown[];
  missed: string[];
}

export function summarize(s: SessionState): Summary {
  const total = s.results.length;
  const correct = s.results.filter((r) => r.correct).length;
  const map = new Map<GeographyCategory, CategoryBreakdown>();
  for (const r of s.results) {
    const cat = FEATURE_BY_ID.get(r.featureId)?.category;
    if (!cat) continue;
    const e = map.get(cat) ?? { category: cat, correct: 0, total: 0 };
    e.total++;
    if (r.correct) e.correct++;
    map.set(cat, e);
  }
  return {
    total,
    correct,
    accuracy: total ? correct / total : 0,
    score: s.score,
    avgTimeMs: total ? s.results.reduce((a, r) => a + r.timeMs, 0) / total : 0,
    bestStreak: s.bestStreak,
    byCategory: CATEGORIES.map((c) => map.get(c)).filter((x): x is CategoryBreakdown => !!x),
    missed: s.results.filter((r) => !r.correct).map((r) => r.featureId),
  };
}
