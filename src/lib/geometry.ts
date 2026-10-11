import type { Geometry } from "geojson";
import { FEATURE_BY_ID } from "@/data/features";
import type { GeographyCategory } from "./types";

type CategoryGeometry = Record<string, Geometry>;

const cache = new Map<GeographyCategory, CategoryGeometry>();
const inflight = new Map<GeographyCategory, Promise<CategoryGeometry>>();

/** Fetch (and memoise) a category's bundled GeoJSON geometry. Rejects on network/parse errors. */
export function loadCategoryGeometry(cat: GeographyCategory): Promise<CategoryGeometry> {
  const hit = cache.get(cat);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(cat);
  if (pending) return pending;
  const p = fetch(`/data/geometry/${cat}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Geometry for ${cat}: HTTP ${r.status}`);
      return r.json() as Promise<CategoryGeometry>;
    })
    .then((g) => {
      cache.set(cat, g);
      return g;
    })
    .finally(() => inflight.delete(cat));
  inflight.set(cat, p);
  return p;
}

export async function loadCategories(cats: Iterable<GeographyCategory>): Promise<void> {
  await Promise.all([...new Set(cats)].map(loadCategoryGeometry));
}

export function categoriesOfFeatures(ids: Iterable<string>): GeographyCategory[] {
  const out = new Set<GeographyCategory>();
  for (const id of ids) {
    const f = FEATURE_BY_ID.get(id);
    if (f) out.add(f.category);
  }
  return [...out];
}

/** Synchronous lookup; only valid after the category was loaded. */
export function getGeometry(featureId: string): Geometry | undefined {
  const f = FEATURE_BY_ID.get(featureId);
  return f ? cache.get(f.category)?.[featureId] : undefined;
}

/** Test/dev hook. */
export function primeGeometryCache(cat: GeographyCategory, data: CategoryGeometry) {
  cache.set(cat, data);
}
