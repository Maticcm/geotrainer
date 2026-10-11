import type { Difficulty } from "./types";

export const MAX_SPEED_BONUS = 30;
export const SPEED_LIMIT_MS: Record<Difficulty, number> = { easy: 30000, normal: 20000, hard: 12000 };
export const STREAK_BONUS_STEP = 5;
export const STREAK_BONUS_CAP = 10;

export interface ScoreInput {
  correct: boolean;
  basePoints: number;
  timeMs: number;
  /** Streak length *before* this answer. */
  streakBefore: number;
  difficulty?: Difficulty;
  /** Speed bonus is skipped for exams. */
  speedBonus?: boolean;
  /** e.g. speedrun multiplier. */
  multiplier?: number;
}

export interface ScoreResult {
  base: number;
  speed: number;
  streak: number;
  multiplier: number;
  total: number;
  streakAfter: number;
}

/** Max points a single question can award before multipliers. */
export const MAX_BASE_POINTS = 100 + MAX_SPEED_BONUS + STREAK_BONUS_CAP * STREAK_BONUS_STEP;

export function computeScore(i: ScoreInput): ScoreResult {
  const multiplier = i.multiplier ?? 1;
  const base = Math.max(0, Math.round(i.basePoints));
  let speed = 0;
  let streak = 0;
  if (i.correct) {
    if (i.speedBonus !== false) {
      const limit = SPEED_LIMIT_MS[i.difficulty ?? "normal"];
      speed = Math.round(MAX_SPEED_BONUS * Math.max(0, 1 - i.timeMs / limit));
    }
    streak = Math.min(i.streakBefore, STREAK_BONUS_CAP) * STREAK_BONUS_STEP;
  }
  const total = Math.round((base + speed + streak) * multiplier);
  return { base, speed, streak, multiplier, total, streakAfter: i.correct ? i.streakBefore + 1 : 0 };
}

/** Speedrun multiplier from streak: x1 → x1.5 every 5 correct answers, capped. */
export function speedrunMultiplier(streak: number, enabled: boolean, cap = 3): number {
  if (!enabled) return 1;
  return Math.min(cap, 1 + Math.floor(streak / 5) * 0.5);
}
