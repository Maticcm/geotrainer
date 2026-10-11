import type { Geometry } from "geojson";
import type { Difficulty, FeatureMeta, GeographyCategory, LatLng } from "./types";
import {
  type Compass,
  compassDirection,
  distanceToGeometry,
  geometryExtentKm,
  normalizeLatLng,
} from "./spatial";

export const TOLERANCE_MULTIPLIER: Record<Difficulty, number> = { easy: 1.5, normal: 1, hard: 0.6 };

/** Default click tolerance (km) derived from the feature's category, geometry type, and extent. */
export function defaultToleranceKm(g: Geometry, category?: GeographyCategory): number {
  const ext = geometryExtentKm(g);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  if (category) {
    switch (category) {
      case "rivers":
        // Rivers are thin 1D lines with 0 area across large continents, invisible on blind maps.
        // A very generous 400–550 km corridor across the river basin gives students forgiving lenience.
        return clamp(ext * 0.14, 400, 550);

      case "canals-straits":
        // Narrow straits and canals (Suez, Panama, Gibraltar, Bosporus, Dardanelles)
        // High leniency (420–550 km) so clicking near the isthmus or strait is comfortably accepted.
        return clamp(ext * 0.35, 420, 550);

      case "mountains":
        // Peaks (Point, e.g. Kilimanjaro) and mountain ranges (Alps, Himalayas, Andes, Urals, Rockies, etc.)
        return g.type === "Point" ? 450 : clamp(ext * 0.16, 320, 550);

      case "lakes":
        // Large and small lakes (Caspian Sea, Titicaca, Tanganyika, Victoria, Baikal, Chad, Malawi)
        // Very generous leniency (400–550 km) so clicking near small or narrow lakes easily hits.
        return clamp(ext * 0.22, 400, 550);

      case "islands":
        // Small and large islands / archipelagos (Corsica, Balearics, Maldives, Seychelles, Taiwan, Sri Lanka, etc.)
        // High leniency (420–650 km) for small island targets on global maps.
        return clamp(ext * 0.25, 420, 650);

      case "deserts":
        // Desert regions
        return clamp(ext * 0.15, 320, 520);

      case "peninsulas":
        // Peninsulas (Deccan, Iberian, Balkan, Apennine)
        return clamp(ext * 0.08, 100, 300);

      case "oceans-seas":
        return clamp(ext * 0.08, 300, 550);

      case "continents":
        // Continents are massive continental landmasses.
        // Generous tolerance (450–850 km) ensures offshore waters,
        // adjacent archipelagos, and finger taps are comfortably recognized.
        return clamp(ext * 0.08, 450, 850);

      case "countries":
        return clamp(ext * 0.04, 50, 200);
    }
  }

  switch (g.type) {
    case "Point":
      return 420;
    case "LineString":
    case "MultiLineString":
      return clamp(ext * 0.12, 380, 520);
    default:
      return clamp(ext * 0.08, 300, 480);
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
