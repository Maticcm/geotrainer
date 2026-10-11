/** Modified SM-2 spaced repetition, tuned for exam cramming (short early intervals). */
export const DAY_MS = 86_400_000;
export const RELEARN_MS = 10 * 60_000;

export interface FeatureProgress {
  attempts: number;
  correct: number;
  incorrect: number;
  totalTimeMs: number;
  /** SM-2 ease factor, >= 1.3 */
  ease: number;
  /** Current interval in days (0 = relearning). */
  interval: number;
  /** Consecutive successful reviews. */
  repetitions: number;
  lapses: number;
  /** Epoch ms when next review is due. */
  due: number;
  lastSeen: number;
  lastResult: boolean | null;
}

export function newFeatureProgress(): FeatureProgress {
  return { attempts: 0, correct: 0, incorrect: 0, totalTimeMs: 0, ease: 2.5, interval: 0, repetitions: 0, lapses: 0, due: 0, lastSeen: 0, lastResult: null };
}

/** SM-2 quality 0–5 from the outcome. Fails give 1; successes 3–5 depending on accuracy and speed. */
export function qualityOf(correct: boolean, accuracy: number, timeMs: number, fastMs = 8000): number {
  if (!correct) return 1;
  if (accuracy >= 0.9 && timeMs <= fastMs) return 5;
  if (accuracy >= 0.7) return 4;
  return 3;
}

export function reviewFeature(p: FeatureProgress, quality: number, timeMs: number, now: number): FeatureProgress {
  const next: FeatureProgress = {
    ...p,
    attempts: p.attempts + 1,
    totalTimeMs: p.totalTimeMs + Math.max(0, timeMs),
    lastSeen: now,
  };
  if (quality < 3) {
    next.incorrect = p.incorrect + 1;
    next.repetitions = 0;
    next.interval = 0;
    next.lapses = p.lapses + 1;
    next.ease = Math.max(1.3, p.ease - 0.2);
    next.due = now + RELEARN_MS;
    next.lastResult = false;
    return next;
  }
  next.correct = p.correct + 1;
  next.repetitions = p.repetitions + 1;
  next.ease = Math.max(1.3, p.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  next.interval = next.repetitions === 1 ? 1 : next.repetitions === 2 ? 3 : Math.max(1, Math.round(Math.max(p.interval, 1) * next.ease));
  next.due = now + next.interval * DAY_MS;
  next.lastResult = true;
  return next;
}

/** 0 = new, 1 = learning, 2 = familiar, 3 = good, 4 = mastered. */
export function masteryLevel(p: FeatureProgress | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!p || p.attempts === 0) return 0;
  if (p.repetitions >= 5 && p.interval >= 20) return 4;
  if (p.repetitions >= 3 && p.interval >= 7) return 3;
  if (p.repetitions >= 2) return 2;
  return 1;
}

/** Sampling weight for choosing the next question. Mastered items keep a small non-zero weight. */
export function selectionWeight(p: FeatureProgress | undefined, now: number): number {
  if (!p || p.attempts === 0) return 1;
  if (p.due <= now) {
    const overdueDays = Math.min(5, (now - p.due) / DAY_MS);
    return 2 + overdueDays + Math.min(3, p.lapses * 0.5);
  }
  return masteryLevel(p) >= 4 ? 0.06 : 0.25;
}

/** Higher = weaker. Used by the Weak Spots mode. */
export function weaknessScore(p: FeatureProgress | undefined): number {
  if (!p || p.attempts === 0) return 0;
  const missRate = p.incorrect / p.attempts;
  return missRate * 3 + p.lapses * 0.5 + (p.lastResult === false ? 1 : 0) + (2.5 - p.ease) * 0.5;
}
