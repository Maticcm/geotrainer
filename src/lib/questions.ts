import centroidsJson from "@/data/centroids.json";
import { FEATURE_BY_ID, FEATURES } from "@/data/features";
import { canonicalAnswer } from "./answers";
import { haversineKm } from "./spatial";
import { type FeatureProgress, masteryLevel, selectionWeight, weaknessScore } from "./srs";
import type { GameMode } from "./progress";
import type { Difficulty, FeatureMeta, GeographyCategory } from "./types";

export type QuestionKind = "locate";

export interface Question {
  id: string;
  kind: QuestionKind;
  featureId: string;
  /** Optional feature ids shown as options */
  options?: string[];
}

export interface GenerateConfig {
  mode: GameMode;
  categories: GeographyCategory[];
  count: number;
  difficulty: Difficulty;
  progress: Record<string, FeatureProgress>;
  now: number;
  rng?: () => number;
  /** Include non-worksheet extras. Exams never do. */
  includeExtras?: boolean;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted sampling without replacement. */
export function weightedSample<T>(items: readonly T[], weight: (t: T) => number, n: number, rng: Rng): T[] {
  const pool = items.map((item) => ({ item, w: Math.max(1e-6, weight(item)) }));
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rng() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return out;
}

const difficultyBias: Record<Difficulty, Record<1 | 2 | 3, number>> = {
  easy: { 1: 1, 2: 0.6, 3: 0.35 },
  normal: { 1: 1, 2: 1, 3: 1 },
  hard: { 1: 0.5, 2: 0.8, 3: 1 },
};

const centroids = centroidsJson as unknown as Record<string, [number, number]>;
function centerOf(f: FeatureMeta) {
  if (f.approx) return { lat: f.approx.lat, lng: f.approx.lng };
  const c = centroids[f.id];
  return c ? { lat: c[0], lng: c[1] } : { lat: 0, lng: 0 };
}

/** Plausible distractors: same category, geographically near, never sharing a name with the target. */
export function pickDistractors(target: FeatureMeta, count: number, rng: Rng, includeExtras = true): FeatureMeta[] {
  const targetNames = new Set([target.name, ...target.aliases].map(canonicalAnswer));
  const clash = (f: FeatureMeta) => [f.name, ...f.aliases].some((n) => targetNames.has(canonicalAnswer(n)));
  const pool = FEATURES.filter((f) => f.id !== target.id && f.category === target.category && !clash(f) && (includeExtras || f.syllabus));
  const here = centerOf(target);
  const ranked = [...pool].sort((a, b) => haversineKm(here, centerOf(a)) - haversineKm(here, centerOf(b)));
  const near = ranked.slice(0, Math.max(count + 3, Math.ceil(ranked.length / 2)));
  const chosen = shuffle(near, rng).slice(0, count);
  if (chosen.length < count) {
    // tiny category: pad from other categories rather than showing fewer than 4 options
    const rest = FEATURES.filter((f) => f.id !== target.id && f.syllabus && !chosen.includes(f) && !clash(f));
    chosen.push(...shuffle(rest, rng).slice(0, count - chosen.length));
  }
  return chosen;
}

export function buildOptions(target: FeatureMeta, rng: Rng): string[] {
  return shuffle([target, ...pickDistractors(target, 3, rng)], rng).map((f) => f.id);
}

/** Features eligible for a session. */
export function candidatePool(cfg: Pick<GenerateConfig, "mode" | "categories" | "progress" | "includeExtras">): FeatureMeta[] {
  const cats = new Set(cfg.categories);
  const exam = cfg.mode === "exam";
  let pool = FEATURES.filter((f) => cats.has(f.category) && (f.syllabus || (cfg.includeExtras && !exam)));
  if (cfg.mode === "weak") pool = pool.filter((f) => cfg.progress[f.id]?.attempts && masteryLevel(cfg.progress[f.id]) < 3);
  return pool;
}

/**
 * Build a session. Never returns duplicates, never substitutes a different feature:
 * if the pool is smaller than `count`, fewer questions are returned.
 */
export function generateQuestions(cfg: GenerateConfig): Question[] {
  const rng = cfg.rng ?? Math.random;
  const pool = candidatePool(cfg);
  const n = Math.min(cfg.count, pool.length);
  let picked: FeatureMeta[];
  if (cfg.mode === "exam") {
    picked = shuffle(pool, rng).slice(0, n);
  } else if (cfg.mode === "weak") {
    picked = weightedSample(pool, (f) => 0.5 + weaknessScore(cfg.progress[f.id]), n, rng);
  } else {
    picked = weightedSample(pool, (f) => selectionWeight(cfg.progress[f.id], cfg.now) * difficultyBias[cfg.difficulty][f.difficulty], n, rng);
  }
  return picked.map((f, i) => ({
    id: `${i}-${f.id}`,
    kind: "locate" as const,
    featureId: f.id,
  }));
}

export function categoryOf(featureId: string): GeographyCategory | undefined {
  return FEATURE_BY_ID.get(featureId)?.category;
}
