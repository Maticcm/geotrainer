import type { Geometry, Position } from "geojson";
import { describe, expect, it } from "vitest";
import {
  compassDirection,
  distanceToGeometry,
  geometryContains,
  geometryExtentKm,
  haversineKm,
  normLng,
  pointInPolygon,
  shiftGeometry,
  unwrapRing,
} from "./spatial";

const square = (x0: number, y0: number, x1: number, y1: number): Position[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const poly = (...rings: Position[][]): Geometry => ({ type: "Polygon", coordinates: rings });

describe("normLng / haversine", () => {
  it("wraps longitudes into [-180,180)", () => {
    expect(normLng(190)).toBe(-170);
    expect(normLng(-190)).toBe(170);
    expect(normLng(540)).toBe(-180);
    expect(normLng(10)).toBe(10);
  });
  it("computes known distances", () => {
    // Ljubljana – Vienna ≈ 278 km
    const d = haversineKm({ lat: 46.0569, lng: 14.5058 }, { lat: 48.2082, lng: 16.3738 });
    expect(d).toBeGreaterThan(270);
    expect(d).toBeLessThan(290);
    expect(haversineKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 })).toBeLessThan(120);
  });
});

describe("point in polygon", () => {
  const country = poly(square(10, 40, 20, 50));
  it("detects points inside and outside", () => {
    expect(geometryContains(country, { lat: 45, lng: 15 })).toBe(true);
    expect(geometryContains(country, { lat: 45, lng: 25 })).toBe(false);
    expect(geometryContains(country, { lat: 55, lng: 15 })).toBe(false);
  });
  it("respects holes", () => {
    const donut = poly(square(0, 0, 10, 10), square(4, 4, 6, 6));
    expect(pointInPolygon({ lat: 2, lng: 2 }, donut.type === "Polygon" ? donut.coordinates : [])).toBe(true);
    expect(pointInPolygon({ lat: 5, lng: 5 }, donut.type === "Polygon" ? donut.coordinates : [])).toBe(false);
  });
  it("handles multipart geometries (any part counts)", () => {
    const multi: Geometry = { type: "MultiPolygon", coordinates: [[square(0, 0, 5, 5)], [square(100, -40, 110, -30)]] };
    expect(geometryContains(multi, { lat: 2, lng: 2 })).toBe(true);
    expect(geometryContains(multi, { lat: -35, lng: 105 })).toBe(true);
    expect(geometryContains(multi, { lat: 20, lng: 50 })).toBe(false);
  });
  it("handles a polygon that crosses the antimeridian (unsplit, Fiji-like)", () => {
    // ring goes 170° → 190° (= -170°)
    const fiji = poly([[170, -20], [-170, -20], [-170, -10], [170, -10], [170, -20]]);
    expect(geometryContains(fiji, { lat: -15, lng: 179 })).toBe(true);
    expect(geometryContains(fiji, { lat: -15, lng: -179 })).toBe(true);
    expect(geometryContains(fiji, { lat: -15, lng: 181 })).toBe(true); // 181° ≡ -179°
    expect(geometryContains(fiji, { lat: -15, lng: 160 })).toBe(false);
    expect(geometryContains(fiji, { lat: -15, lng: -160 })).toBe(false);
  });
  it("handles split polygons on both sides of ±180", () => {
    const east: Geometry = poly(square(170, -20, 180, -10));
    const west: Geometry = poly(square(-180, -20, -170, -10));
    const multi: Geometry = { type: "MultiPolygon", coordinates: [(east as { coordinates: Position[][] }).coordinates, (west as { coordinates: Position[][] }).coordinates] };
    expect(geometryContains(multi, { lat: -15, lng: 175 })).toBe(true);
    expect(geometryContains(multi, { lat: -15, lng: -175 })).toBe(true);
    expect(geometryContains(multi, { lat: -15, lng: 0 })).toBe(false);
  });
  it("unwraps rings continuously", () => {
    const u = unwrapRing([[170, 0], [-170, 0], [-160, 0]]);
    expect(u.map((p) => p[0])).toEqual([170, 190, 200]);
  });
});

describe("distance to lines (rivers, mountain ranges)", () => {
  const river: Geometry = { type: "LineString", coordinates: [[30, 0], [30, 30]] }; // meridian line
  it("is ~0 on the line", () => {
    expect(distanceToGeometry(river, { lat: 10, lng: 30 }).distanceKm).toBeLessThan(0.5);
  });
  it("measures perpendicular distance near the river", () => {
    const r = distanceToGeometry(river, { lat: 10, lng: 31 });
    expect(r.distanceKm).toBeGreaterThan(105);
    expect(r.distanceKm).toBeLessThan(115);
    expect(r.nearest.lng).toBeCloseTo(30, 1);
    expect(r.nearest.lat).toBeCloseTo(10, 0);
  });
  it("uses the end point beyond the segment end", () => {
    const r = distanceToGeometry(river, { lat: 35, lng: 30 });
    expect(r.distanceKm).toBeGreaterThan(540);
    expect(r.distanceKm).toBeLessThan(570);
    expect(r.nearest.lat).toBeCloseTo(30, 0);
  });
  it("takes the closest part of a multi-line", () => {
    const multi: Geometry = { type: "MultiLineString", coordinates: [[[0, 0], [0, 10]], [[50, 0], [50, 10]]] };
    const r = distanceToGeometry(multi, { lat: 5, lng: 49 });
    expect(r.distanceKm).toBeLessThan(115);
    expect(r.nearest.lng).toBeCloseTo(50, 1);
  });
  it("works across the antimeridian", () => {
    const line: Geometry = { type: "LineString", coordinates: [[179, 0], [179, 10]] };
    const r = distanceToGeometry(line, { lat: 5, lng: -179 });
    expect(r.distanceKm).toBeGreaterThan(215);
    expect(r.distanceKm).toBeLessThan(230);
  });
  it("mountain range as polygon: inside = 0, outside = boundary distance", () => {
    const range = poly(square(70, 25, 90, 35));
    expect(distanceToGeometry(range, { lat: 30, lng: 80 }).inside).toBe(true);
    const r = distanceToGeometry(range, { lat: 30, lng: 91 });
    expect(r.inside).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(90);
    expect(r.distanceKm).toBeLessThan(100);
  });
});

describe("points, extent, direction, shifting", () => {
  it("distance to a Point feature", () => {
    const peak: Geometry = { type: "Point", coordinates: [37.35, -3.07] };
    expect(distanceToGeometry(peak, { lat: -3.07, lng: 37.35 }).distanceKm).toBeLessThan(0.1);
    expect(distanceToGeometry(peak, { lat: 0, lng: 37.35 }).distanceKm).toBeGreaterThan(300);
  });
  it("extent of large vs small", () => {
    expect(geometryExtentKm(poly(square(0, 0, 10, 10)))).toBeGreaterThan(1400);
    expect(geometryExtentKm(poly(square(0, 0, 0.1, 0.1)))).toBeLessThan(20);
  });
  it("compass direction", () => {
    expect(compassDirection({ lat: 0, lng: 0 }, { lat: 10, lng: 0 })).toBe("N");
    expect(compassDirection({ lat: 0, lng: 0 }, { lat: 0, lng: 10 })).toBe("E");
    expect(compassDirection({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBe("E");
    expect(compassDirection({ lat: 0, lng: 0 }, { lat: -10, lng: -10 })).toBe("SW");
  });
  it("shifts geometry for wrapped world copies", () => {
    const s = shiftGeometry({ type: "Point", coordinates: [10, 20] }, 360);
    expect(s).toEqual({ type: "Point", coordinates: [370, 20] });
  });
  it("is stable near the poles", () => {
    const coast: Position[] = [];
    for (let lng = -180; lng <= 180; lng += 10) coast.push([lng, -60]);
    const antarctica = poly([[-180, -90], ...coast, [180, -90], [-180, -90]]);
    expect(geometryContains(antarctica, { lat: -80, lng: 45 })).toBe(true);
    const r = distanceToGeometry(antarctica, { lat: -50, lng: 45 });
    expect(Number.isFinite(r.distanceKm)).toBe(true);
    expect(r.distanceKm).toBeGreaterThan(1000);
    expect(r.distanceKm).toBeLessThan(1200);
  });
  it("handles rings that pass through the pole with a ±360° jump (Natural Earth Antarctica)", () => {
    const ring: Position[] = [];
    for (let lng = -30; lng <= 180; lng += 10) ring.push([lng, -70]);
    ring.push([180, -90], [-180, -90]);
    for (let lng = -180; lng <= -30; lng += 10) ring.push([lng, -70]);
    ring.push([-30, -70]);
    const g = poly(ring);
    expect(geometryContains(g, { lat: -85, lng: 90 })).toBe(true);
    expect(geometryContains(g, { lat: -85, lng: -120 })).toBe(true);
    expect(geometryContains(g, { lat: -85, lng: 175 })).toBe(true);
    expect(geometryContains(g, { lat: -60, lng: 90 })).toBe(false);
    expect(geometryContains(g, { lat: 10, lng: 90 })).toBe(false);
  });
});
