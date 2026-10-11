import type { Geometry } from "geojson";

export type GeographyCategory =
  | "oceans-seas"
  | "continents"
  | "mountains"
  | "canals-straits"
  | "countries"
  | "rivers"
  | "lakes"
  | "islands"
  | "deserts"
  | "peninsulas";

export const CATEGORIES: GeographyCategory[] = [
  "oceans-seas",
  "continents",
  "mountains",
  "canals-straits",
  "countries",
  "rivers",
  "lakes",
  "islands",
  "deserts",
  "peninsulas",
];

export type Lang = "sl" | "en";
export type Difficulty = "easy" | "normal" | "hard";

/** Approximate location, used only where no verified geometry is available. */
export interface ApproxLocation {
  lat: number;
  lng: number;
  toleranceKm: number;
}

/** Static feature metadata (geometry is loaded lazily from /data/geometry/<category>.json). */
export interface FeatureMeta {
  id: string;
  category: GeographyCategory;
  /** Syllabus (Slovenian) name. */
  name: string;
  nameEn: string;
  aliases: string[];
  difficulty: 1 | 2 | 3;
  source: string;
  geometryKind: "geometry" | "approximate";
  approx?: ApproxLocation;
  /** Part of the school worksheet (exam simulation uses only these). */
  syllabus: boolean;
  fact: Record<Lang, string>;
  /** Documented interpretation / limitation of the syllabus term. */
  note?: string;
  /** Override for the click tolerance in km. */
  toleranceKm?: number;
}

export type GeometryType = "Point" | "LineString" | "Polygon" | "MultiLineString" | "MultiPolygon";

export interface GeographyFeature extends FeatureMeta {
  geometryType: GeometryType;
  geometry: Geometry;
}

export type LatLng = { lat: number; lng: number };
