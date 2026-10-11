import type { Geometry, Position } from "geojson";
import type { LatLng } from "./types";

export const EARTH_RADIUS_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Normalise a longitude into [-180, 180). Leaflet may report e.g. 190° after panning across the antimeridian. */
export function normLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

export function normalizeLatLng(p: LatLng): LatLng {
  return { lat: clampLat(p.lat), lng: normLng(p.lng) };
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------- azimuthal equidistant projection centred on the click ----------
// Exact distances from the centre, insensitive to the antimeridian / poles.
type XY = [number, number];

function project(center: LatLng, p: Position): XY {
  const φ1 = rad(center.lat);
  const φ2 = rad(p[1]);
  const dλ = rad(normLng(p[0] - center.lng));
  const cosc = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const c = Math.acos(Math.max(-1, Math.min(1, cosc)));
  if (c < 1e-12) return [0, 0];
  const k = c / Math.sin(c || 1);
  const x = EARTH_RADIUS_KM * k * Math.cos(φ2) * Math.sin(dλ);
  const y = EARTH_RADIUS_KM * k * (Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ));
  return [x, y];
}

function unproject(center: LatLng, [x, y]: XY): LatLng {
  const rho = Math.hypot(x, y);
  if (rho < 1e-9) return { ...center };
  const c = rho / EARTH_RADIUS_KM;
  const φ1 = rad(center.lat);
  const φ = Math.asin(Math.max(-1, Math.min(1, Math.cos(c) * Math.sin(φ1) + (y * Math.sin(c) * Math.cos(φ1)) / rho)));
  const λ = rad(center.lng) + Math.atan2(x * Math.sin(c), rho * Math.cos(φ1) * Math.cos(c) - y * Math.sin(φ1) * Math.sin(c));
  return { lat: deg(φ), lng: normLng(deg(λ)) };
}

/** Distance (km) from the origin to segment AB and the nearest point on it (planar coords). */
function originToSegment(a: XY, b: XY): { d: number; pt: XY } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(a[0] * dx + a[1] * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const pt: XY = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(pt[0], pt[1]), pt };
}

// ---------- point-in-polygon with antimeridian support ----------

/** Make longitudes continuous along the ring (no ±360° jumps). */
export function unwrapRing(ring: Position[]): Position[] {
  if (ring.length === 0) return [];
  const out: Position[] = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prev = out[i - 1][0];
    while (lng - prev > 180) lng -= 360;
    while (lng - prev < -180) lng += 360;
    out.push([lng, ring[i][1]]);
  }
  return out;
}

function rayCast(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Unwrap the ring and, if it winds once around the globe (encloses a pole, e.g. Antarctica),
 * close it along that pole so a planar ray cast is valid.
 */
function planarRing(ring: Position[]): Position[] {
  const u = unwrapRing(ring);
  if (u.length < 2) return u;
  const first = u[0];
  const last = u[u.length - 1];
  if (Math.abs(last[0] - first[0]) > 180) {
    const meanLat = u.reduce((s, p) => s + p[1], 0) / u.length;
    const pole = meanLat >= 0 ? 90 : -90;
    u.push([last[0], pole], [first[0], pole]);
  }
  return u;
}

function inRing(p: LatLng, ring: Position[]): boolean {
  const u = planarRing(ring);
  for (const shift of [-360, 0, 360]) {
    if (rayCast(p.lng + shift, p.lat, u)) return true;
  }
  return false;
}

/** Polygon = [outer, ...holes] */
export function pointInPolygon(p: LatLng, polygon: Position[][]): boolean {
  if (polygon.length === 0 || !inRing(p, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (inRing(p, polygon[i])) return false;
  return true;
}

// ---------- geometry helpers ----------
export function polygonsOf(g: Geometry): Position[][][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

export function linesOf(g: Geometry): Position[][] {
  if (g.type === "LineString") return [g.coordinates];
  if (g.type === "MultiLineString") return g.coordinates;
  return [];
}

export function isAreal(g: Geometry): boolean {
  return g.type === "Polygon" || g.type === "MultiPolygon";
}

export function geometryContains(g: Geometry, p: LatLng): boolean {
  return polygonsOf(g).some((poly) => pointInPolygon(p, poly));
}

export interface DistanceResult {
  distanceKm: number;
  /** Closest point on the feature (the click itself when inside an area). */
  nearest: LatLng;
  inside: boolean;
}

/**
 * Distance from a click to a geometry. Areas: 0 inside, otherwise to the nearest boundary.
 * Lines: to the nearest segment. Points: great-circle distance. Multipart geometries
 * return the closest part.
 */
export function distanceToGeometry(g: Geometry, click: LatLng): DistanceResult {
  const p = normalizeLatLng(click);
  if (g.type === "Point") {
    const target = { lat: g.coordinates[1], lng: g.coordinates[0] };
    return { distanceKm: haversineKm(p, target), nearest: target, inside: false };
  }
  if (g.type === "MultiPoint") {
    let best: DistanceResult | null = null;
    for (const c of g.coordinates) {
      const r = distanceToGeometry({ type: "Point", coordinates: c }, p);
      if (!best || r.distanceKm < best.distanceKm) best = r;
    }
    return best ?? { distanceKm: Infinity, nearest: p, inside: false };
  }
  if (isAreal(g) && geometryContains(g, p)) return { distanceKm: 0, nearest: p, inside: true };

  const rings: Position[][] = isAreal(g) ? polygonsOf(g).flat() : linesOf(g);
  let bestD = Infinity;
  let bestPt: XY = [0, 0];
  for (const ring of rings) {
    let prev = project(p, ring[0]);
    for (let i = 1; i < ring.length; i++) {
      const cur = project(p, ring[i]);
      const r = originToSegment(prev, cur);
      if (r.d < bestD) {
        bestD = r.d;
        bestPt = r.pt;
      }
      prev = cur;
    }
  }
  return { distanceKm: bestD, nearest: unproject(p, bestPt), inside: false };
}

/** Rough diagonal extent of a geometry in km (bounding box diagonal, antimeridian-aware). */
export function geometryExtentKm(g: Geometry): number {
  const pts: Position[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") pts.push(c as Position);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  if (g.type !== "GeometryCollection") walk(g.coordinates);
  if (pts.length === 0) return 0;
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lng, lat] of pts) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  const mid = (minLat + maxLat) / 2;
  const w = haversineKm({ lat: mid, lng: minLng }, { lat: mid, lng: maxLng });
  const spanLng = maxLng - minLng;
  const width = spanLng > 180 ? Math.min(40075 * Math.cos(rad(mid)), w + 20000) : w;
  const h = haversineKm({ lat: minLat, lng: 0 }, { lat: maxLat, lng: 0 });
  return Math.hypot(width, h);
}

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Compass = (typeof POINTS)[number];

/** 8-wind compass direction from `from` towards `to`. */
export function compassDirection(from: LatLng, to: LatLng): Compass {
  const φ1 = rad(from.lat), φ2 = rad(to.lat), dλ = rad(normLng(to.lng - from.lng));
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  const brng = (deg(Math.atan2(y, x)) + 360) % 360;
  return POINTS[Math.round(brng / 45) % 8];
}

/** Shift all longitudes of a geometry by dx degrees (used to draw wrapped world copies). */
export function shiftGeometry(g: Geometry, dx: number): Geometry {
  const shift = (c: unknown): unknown =>
    Array.isArray(c) && typeof c[0] === "number" ? [(c[0] as number) + dx, c[1]] : Array.isArray(c) ? c.map(shift) : c;
  if (g.type === "GeometryCollection") return g;
  return { ...g, coordinates: shift(g.coordinates) } as Geometry;
}
