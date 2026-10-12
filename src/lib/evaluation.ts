import type { Geometry } from "geojson";
import type { Difficulty, FeatureMeta, GeographyCategory, LatLng } from "./types";
import {
  type Compass,
  compassDirection,
  distanceToGeometry,
  geometryExtentKm,
  normalizeLatLng,
} from "./spatial";

export const TOLERANCE_MULTIPLIER: Record<Difficulty, number> = { easy: 1.4, normal: 1, hard: 0.8 };

/** Default click tolerance (km) derived from the feature's category, geometry type, and extent. */
export function defaultToleranceKm(g: Geometry, category?: GeographyCategory): number {
  const ext = geometryExtentKm(g);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  if (category) {
    switch (category) {
      case "rivers":
        // Rivers are thin 1D lines with 0 area across large continents, invisible on blind maps.
        // A generous 550–850 km corridor across the river basin gives students forgiving lenience
        // on both mobile touchscreens and desktop mice.
        return clamp(ext * 0.18, 550, 850);

      case "canals-straits":
        // Narrow straits and canals (Suez, Panama, Gibraltar, Bosporus, Dardanelles)
        // High leniency (500–750 km) so tapping near the isthmus or strait is comfortably accepted on all screens.
        return clamp(ext * 0.35, 500, 750);

      case "mountains":
        // Peaks (Point, e.g. Kilimanjaro) and mountain ranges (Alps, Himalayas, Andes, Urals, Rockies, etc.)
        return g.type === "Point" ? 550 : clamp(ext * 0.12, 350, 520);

      case "lakes":
        // Large and small lakes (Caspian Sea, Titicaca, Tanganyika, Victoria, Baikal, Chad, Malawi)
        // Very generous leniency (500–750 km) so clicking anywhere in or near lakes easily hits on touchscreens.
        return clamp(ext * 0.22, 500, 750);

      case "islands":
        // Small and large islands / archipelagos (Corsica, Balearics, Maldives, Seychelles, Taiwan, Sri Lanka, etc.)
        // High leniency (500–800 km) for small island targets on global maps.
        return clamp(ext * 0.25, 500, 800);

      case "deserts":
        // Desert regions
        return clamp(ext * 0.15, 380, 650);

      case "peninsulas":
        // Peninsulas (Deccan, Iberian, Balkan, Apennine)
        return clamp(ext * 0.08, 100, 320);

      case "oceans-seas":
        return clamp(ext * 0.10, 400, 750);

      case "continents":
        // Continents are massive continental landmasses.
        // Generous tolerance ensures offshore waters and adjacent archipelagos are recognized.
        return clamp(ext * 0.10, 650, 1100);

      case "countries":
        // Generous tolerance ensures border clicks and finger taps on smaller countries are recognized.
        return clamp(ext * 0.06, 120, 350);
    }
  }

  switch (g.type) {
    case "Point":
      return 650;
    case "LineString":
    case "MultiLineString":
      return clamp(ext * 0.18, 550, 850);
    default:
      return clamp(ext * 0.12, 450, 750);
  }
}

export interface LocateEvaluation {
  correct: boolean;
  /** 0..1, 1 = perfect (inside / on the feature). */
  accuracy: number;
  distanceKm: number;
  toleranceKm: number;
  inside: boolean;
  nearest: LatLng;
  direction: Compass | null;
  /** True when the answer key is an approximate coordinate, not verified geometry. */
  approximate: boolean;
  basePoints: number;
}

/** The geometry used to grade a feature: real geometry or a Point from the approximate coordinate. */
export function gradingGeometry(meta: FeatureMeta, geometry: Geometry | undefined): Geometry | null {
  if (meta.geometryKind === "approximate" && meta.approx) {
    return { type: "Point", coordinates: [meta.approx.lng, meta.approx.lat] };
  }
  if (geometry) return geometry;
  if (meta.approx) {
    return { type: "Point", coordinates: [meta.approx.lng, meta.approx.lat] };
  }
  return null;
}

export function evaluateClick(
  meta: FeatureMeta,
  geometry: Geometry | undefined,
  click: LatLng,
  difficulty: Difficulty = "normal",
): LocateEvaluation {
  const g = gradingGeometry(meta, geometry);
  if (!g) throw new Error(`No geometry available for ${meta.id}`);
  const p = normalizeLatLng(click);
  const base = meta.approx?.toleranceKm ?? meta.toleranceKm ?? defaultToleranceKm(g, meta.category);
  const toleranceKm = base * TOLERANCE_MULTIPLIER[difficulty];
  const r = distanceToGeometry(g, p);
  const correct = r.inside || r.distanceKm <= toleranceKm;
  let accuracy: number;
  if (r.inside) accuracy = 1;
  else if (correct) accuracy = 1 - 0.3 * (r.distanceKm / toleranceKm);
  else accuracy = 0.4 * Math.exp(-(r.distanceKm - toleranceKm) / 1000);
  const basePoints = correct ? Math.round(60 + 40 * accuracy) : Math.round(25 * Math.exp(-(r.distanceKm - toleranceKm) / 1000));
  return {
    correct,
    accuracy,
    distanceKm: r.distanceKm,
    toleranceKm,
    inside: r.inside,
    nearest: r.nearest,
    direction: r.inside ? null : compassDirection(p, r.nearest),
    approximate: meta.geometryKind === "approximate",
    basePoints,
  };
}
