import { describe, expect, it } from "vitest";
import { FEATURE_BY_ID } from "@/data/features";
import { levenshtein, matchAnswer, normalizeAnswer } from "./answers";
import { evaluateClick, gradingGeometry } from "./evaluation";
import { computeScore, speedrunMultiplier } from "./scoring";
import type { Geometry } from "geojson";

const f = (id: string) => {
  const m = FEATURE_BY_ID.get(id);
  if (!m) throw new Error(id);
  return m;
};

describe("answer normalisation and aliases", () => {
  it("normalises case, diacritics and punctuation", () => {
    expect(normalizeAnswer("  ČRNO   Morje! ")).toBe("crno morje");
    expect(normalizeAnswer("Šrilanka")).toBe("srilanka");
    expect(normalizeAnswer("Sv. Lovrenca")).toBe("sv lovrenca");
  });
  it("matches Slovenian names without diacritics, case-insensitively", () => {
    expect(matchAnswer("crno morje", f("black-sea"))).toBe("exact");
    expect(matchAnswer("ČRNO MORJE", f("black-sea"))).toBe("exact");
    expect(matchAnswer("srilanka", f("sri-lanka"))).toBe("exact");
  });
  it("matches English aliases and abbreviations", () => {
    expect(matchAnswer("Black Sea", f("black-sea"))).toBe("exact");
    expect(matchAnswer("USA", f("usa"))).toBe("exact");
    expect(matchAnswer("United Kingdom", f("united-kingdom"))).toBe("exact");
    expect(matchAnswer("Velika Britanija", f("united-kingdom"))).toBe("exact");
    expect(matchAnswer("Yangtze", f("yangtze"))).toBe("exact");
  });
  it("ignores generic words like 'reka' and 'the'", () => {
    expect(matchAnswer("reka Amazonka", f("amazon"))).toBe("exact");
    expect(matchAnswer("the Nile", f("nile"))).toBe("exact");
    expect(matchAnswer("Jezero Titicaca", f("lake-titicaca"))).toBe("exact");
  });
  it("accepts small typos as 'close' unless strict", () => {
    expect(matchAnswer("Mediteranean Sea", f("mediterranean-sea"))).toBe("close");
    expect(matchAnswer("Mediteranean Sea", f("mediterranean-sea"), true)).toBe("wrong");
  });
  it("rejects wrong and empty answers", () => {
    expect(matchAnswer("Rdeče morje", f("black-sea"))).toBe("wrong");
    expect(matchAnswer("", f("black-sea"))).toBe("wrong");
    expect(matchAnswer("Peru", f("chile"))).toBe("wrong");
  });
  it("levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

const box = (x0: number, y0: number, x1: number, y1: number): Geometry => ({
  type: "Polygon",
  coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
});

describe("geometry-based click evaluation", () => {
  const country = f("italy");
  const g = box(6, 36, 18, 47);
  it("full accuracy inside a polygon", () => {
    const r = evaluateClick(country, g, { lat: 42, lng: 12 });
    expect(r.correct).toBe(true);
    expect(r.inside).toBe(true);
    expect(r.accuracy).toBe(1);
    expect(r.basePoints).toBe(100);
  });
  it("a near miss is worth more than a far miss, and neither is correct", () => {
    const near = evaluateClick(country, g, { lat: 42, lng: 25 });
    const far = evaluateClick(country, g, { lat: -30, lng: 120 });
    expect(near.correct).toBe(false);
    expect(far.correct).toBe(false);
    expect(near.basePoints).toBeGreaterThan(far.basePoints);
    expect(far.basePoints).toBe(0);
    expect(near.direction).toBe("W");
  });
  it("is generous with tolerance on easy and strict on hard", () => {
    const click = { lat: 42, lng: 18.6 }; // ~48 km outside the polygon
    const e = evaluateClick(country, g, click, "easy");
    const h = evaluateClick(country, g, click, "hard");
    expect(e.correct).toBe(true);
    expect(h.correct).toBe(false);
  });
  it("rivers use distance to the line, not to a centre point", () => {
    const line: Geometry = { type: "LineString", coordinates: [[0, 0], [0, 40]] };
    const nile = f("nile");
    const atEnd = evaluateClick(nile, line, { lat: 39, lng: 0.2 });
    const farAlong = evaluateClick(nile, line, { lat: 2, lng: 0.2 });
    expect(atEnd.correct).toBe(true);
    expect(farAlong.correct).toBe(true); // centre (lat 20) is 2000 km away – irrelevant
    expect(evaluateClick(nile, line, { lat: 20, lng: 10 }).correct).toBe(false);
  });
  it("large-area features accept any valid location (multiple valid clicks)", () => {
    const big = box(-80, -60, 80, 60);
    const m = f("pacific-ocean");
    for (const p of [{ lat: 0, lng: -70 }, { lat: 50, lng: 70 }, { lat: -50, lng: 0 }]) {
      expect(evaluateClick(m, big, p).correct).toBe(true);
    }
  });
  it("approximate features are graded against their coordinate and flagged", () => {
    const m = f("bosporus");
    expect(gradingGeometry(m, undefined)).toEqual({ type: "Point", coordinates: [29.07, 41.12] });
    const ok = evaluateClick(m, undefined, { lat: 41.3, lng: 29.0 });
    expect(ok.approximate).toBe(true);
    expect(ok.correct).toBe(true);
    expect(evaluateClick(m, undefined, { lat: 45, lng: 29 }).correct).toBe(false);
  });
  it("throws when no geometry exists for a geometry feature (no silent fallback)", () => {
    expect(() => evaluateClick(f("nile"), undefined, { lat: 0, lng: 0 })).toThrow();
  });
});

describe("scoring", () => {
  it("rewards correct answers with base + speed + streak", () => {
    const r = computeScore({ correct: true, basePoints: 100, timeMs: 0, streakBefore: 3 });
    expect(r.base).toBe(100);
    expect(r.speed).toBe(30);
    expect(r.streak).toBe(15);
    expect(r.total).toBe(145);
    expect(r.streakAfter).toBe(4);
  });
  it("speed bonus decays and reaches zero", () => {
    expect(computeScore({ correct: true, basePoints: 100, timeMs: 10000, streakBefore: 0 }).speed).toBe(15);
    expect(computeScore({ correct: true, basePoints: 100, timeMs: 60000, streakBefore: 0 }).speed).toBe(0);
  });
  it("wrong answers give only partial base points, no bonuses, and reset the streak", () => {
    const r = computeScore({ correct: false, basePoints: 12, timeMs: 1000, streakBefore: 7 });
    expect(r.total).toBe(12);
    expect(r.streakAfter).toBe(0);
  });
  it("caps the streak bonus and supports exam mode without speed bonus", () => {
    expect(computeScore({ correct: true, basePoints: 100, timeMs: 0, streakBefore: 99, speedBonus: false }).total).toBe(150);
  });
  it("applies speedrun multipliers", () => {
    expect(speedrunMultiplier(0, true)).toBe(1);
    expect(speedrunMultiplier(5, true)).toBe(1.5);
    expect(speedrunMultiplier(10, true)).toBe(2);
    expect(speedrunMultiplier(100, true)).toBe(3);
    expect(speedrunMultiplier(10, false)).toBe(1);
    expect(computeScore({ correct: true, basePoints: 100, timeMs: 99999, streakBefore: 0, multiplier: 2 }).total).toBe(200);
  });
});
