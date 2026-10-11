import type { FeatureMeta } from "./types";

/** Lowercase, strip diacritics (č→c, š→s, ž→z, ö→o …) and punctuation, collapse whitespace. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´.,;:!?()"“”-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["the", "reka", "river", "jezero", "lake", "mount", "mt", "gora"]);

/** Same as normalizeAnswer but with generic words ("reka", "lake", "the") removed. */
export function canonicalAnswer(s: string): string {
  const n = normalizeAnswer(s);
  const parts = n.split(" ").filter((w) => !STOP.has(w));
  return parts.length ? parts.join(" ") : n;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type MatchResult = "exact" | "close" | "wrong";

export function allNames(f: FeatureMeta): string[] {
  return [f.name, ...f.aliases];
}

/**
 * Compare a typed answer with the feature's names/aliases.
 * "exact": equal after normalisation; "close": small typo (strict=false only); otherwise "wrong".
 */
export function matchAnswer(input: string, feature: FeatureMeta, strict = false): MatchResult {
  const a = canonicalAnswer(input);
  if (!a) return "wrong";
  const candidates = allNames(feature).map(canonicalAnswer);
  if (candidates.includes(a)) return "exact";
  if (strict) return "wrong";
  for (const c of candidates) {
    const max = c.length >= 10 ? 2 : c.length >= 5 ? 1 : 0;
    if (max > 0 && levenshtein(a, c) <= max) return "close";
  }
  return "wrong";
}
